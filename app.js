const app = require("express")();
const server = require("http").Server(app);
const rp = require("request-promise-native");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const port = 3000;

// API Key
const apiKey = "c8ed5dba70012da14e166b97bfb276ff";

// List of cities provided
const cities = {
  0: ["Jerusalem", "il"],
  1: ["New York", "us"],
  2: ["Dubai", "ae"],
  3: ["Lisbon", "pt"],
  4: ["Oslo", "no"],
  5: ["Paris", "fr"],
  6: ["Berlin", "de"],
  7: ["Athens", "gr"],
  8: ["Seoul", "kr"],
  9: ["Singapore", "sgp"]
};

// Loop API calls on cities 
async function getWeatherForCities() {
    let results = [];
    for (let [city, countryCode] of Object.values(cities)) {
        let weatherResponse = await rp({ url: `http://api.openweathermap.org/data/2.5/forecast?q=${city},${countryCode}&mode=json&appid=${apiKey}`, json: true});
        results.push ({ city, countryCode, list: weatherResponse.list, weatherResponse });
    }

    let summary = results.map(res => {  
        return { city: res.city, countryCode: res.countryCode,
        maxTemperature: getMaxTemperatureCelsius(res.list),
        minTemperature: getMinTemperatureCelsius(res.list),
        totalRainfall: getTotalRainFall(res.list)
    }});

    // Group by date (local) and city
    let resultsGroupedByDateAndCity = {};
    results.forEach(result => {
        result.list.forEach(entry => {
            let localTime = entry.dt + result.weatherResponse.city.timezone;
            let date = new Date(localTime * 1000);
            date.setHours(0,0,0,0);
            let dateKey = date.toISOString().substring(0,10);
            if (!resultsGroupedByDateAndCity[dateKey]) resultsGroupedByDateAndCity[dateKey] = {};
            if (!resultsGroupedByDateAndCity[dateKey][result.city]) resultsGroupedByDateAndCity[dateKey][result.city] = [];
            resultsGroupedByDateAndCity[dateKey][result.city].push(entry);
        });
    });

    // Run through the keys.
    let csvLines = [];

    for (let [date, obj] of Object.entries(resultsGroupedByDateAndCity)) {
        let dailySummary = Object.entries(obj).map(([city, dayList]) => {  
            return { city,
            maxTemperature: getMaxTemperatureCelsius(dayList),
            minTemperature: getMinTemperatureCelsius(dayList),
            totalRainfall: getTotalRainFall(dayList)
        }});

        let resultWithHighestTemperature = [...dailySummary].sort((resA, resB) => resB.maxTemperature - resA.maxTemperature)[0];
        let resultWithLowestTemperature = [...dailySummary].sort((resA, resB) => resA.minTemperature - resB.minTemperature)[0];
        let citiesWithRain = dailySummary.filter(res => res.totalRainfall).map(res => res.city);


        csvLines.push({
            day: date,
            highest: resultWithHighestTemperature.city,
            lowest: resultWithLowestTemperature.city,
            rain: citiesWithRain.join(",")
        });
    }

    const csvWriter = createCsvWriter({
        path: 'weather.csv',
        header: [
          {id: 'day', title: 'Day'},
          {id: 'highest', title: 'City With Highest Temp'},
          {id: 'lowest', title: 'City With Lowest Temp'},
          {id: 'rain', title: 'Cities With Rain '},
        ]
      });
    
      csvWriter
        .writeRecords(csvLines)
        .then(()=> console.log('The CSV file was written successfully'));
}

function KelvinToCelsius(kelvin) {
    return (kelvin - 273.15);
}

// Return the max temperature for the forecast
function getMaxTemperatureCelsius(responseList) {
    // Get a list of the max temperatures for the forecast.
    const maxTemps = responseList.map(entry => Number(entry.main.temp_max));
    return KelvinToCelsius(Math.max(...maxTemps));
}

// Return the min temperature for the forecast
function getMinTemperatureCelsius(responseList) {
    // Get a list of the min temperatures for the forecast.
    const minTemps = responseList.map(entry => Number(entry.main.temp_min));
    return KelvinToCelsius(Math.min(...minTemps));
}

// Return the total rainfall for the forecast
function getTotalRainFall(responseList) {
    // Get a list of the min temperatures for the forecast.
    const rain = responseList.map(entry => { return entry.rain ? Number(entry.rain["3h"]): 0 });
    return rain.reduce((sum, val) => sum + val, 0)
}

getWeatherForCities();

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
