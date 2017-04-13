// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var request	   = require("request");
var geolib	   = require("geolib");
// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router
var url = "http://data.taipei/opendata/datalist/apiAccess?scope=resourceAquire&rid=ddb80380-f1b3-4f8e-8016-7ed9cba571d5" || process.env.OPENDATA_URL


// CUSTOM VALIDATIONS - Can also consider using a middleware ------------
var validateLatLon = function(lat, lon){
	try {
    	if((lat > -90 && lat < 90) && (lng > -180 && lng < 180)) {
			return true
		}
	}
	catch(err) {
    	return false
	}
}

var refWithinTaipei = function(lat, lon){
	approx_center_lat_lng_taipei = {latitude: 25.056469, longitude: 121.513530}   
	radius = 30000
	try {
		if (geolib.isPointInCircle({latitude: lat, longitude: lon}, approx_center_lat_lng_taipei, radius)){
			return true
		}
	}
	catch(err) {
    	return false
	}
	
}

var exceptionAndErrorHandler = function(code, result){
	return { code: code, result: result }
}

// REGISTER OUR ROUTES -------------------------------
router.get('/ubike-station/taipei',function(req,res,next){
	codes = {'OK': 0, 'NO_BIKE_AVAILABLE': 1, 'ERROR': -3, 'INVALID_LOCATION': -1, 'NOT_IN_TAIPEI': -2}
	distance_limit = 600 //how far away in m should stations be from reference point?
	lat = req.query.lat
	lng = req.query.lng

	if (!validateLatLon(lat, lng)){
		return res.status(400).json(exceptionAndErrorHandler(codes['INVALID_LOCATION'], []))
	}

	if (!refWithinTaipei(lat, lng)){
		return res.status(400).json(exceptionAndErrorHandler(codes['NOT_IN_TAIPEI'], []))
	}

	request({
    	url: url,
    	json: true
	}, function (error, response, body) {
    if (!error && response.statusCode === 200) {
        req.data = response.body.result.results
        var input_coords = {'latitude': geolib.useDecimal(lat), 'longitude': geolib.useDecimal(lng)}
		
		nearby_stations = req.data.map(function(el){
			var you_bike_station_coords = {'latitude': geolib.useDecimal(el['lat']), 'longitude': geolib.useDecimal(el['lng'])}
			var distance = geolib.getDistance(input_coords, you_bike_station_coords)
			if (distance <= distance_limit){ 
				return {'station': el['sna'], 'num_ubike': el['sbi']} //, 'distance': distance
			}
			return false
		}).filter(function(el){
			return el != false
		}).sort(function(a, b){
			return a['distance'] > b['distance']
		}).slice(0,2)

		no_bikes_available = nearby_stations.every(function(el){
			return el['num_ubike'] == 0
		})

		if (no_bikes_available){
			return res.status(200).json(exceptionAndErrorHandler(codes['NO_BIKE_AVAILABLE'], []))
		}
		else{
			bikes_available = nearby_stations.filter(function(el){
				return el['num_ubike'] > 0
			})
			return res.status(200).json(exceptionAndErrorHandler(codes['OK'], bikes_available))
		}
    }
    else{
    	return res.status(400).json(exceptionAndErrorHandler(codes['ERROR'], []))
    }
	})
})






// all of our routes will be prefixed with /v1
app.use('/v1', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);