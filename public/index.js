#!/usr/bin/nodejs


// -------------- load packages -------------- //
var cookieSession = require('cookie-session');
var express = require('express');
const {  AuthorizationCode } = require('simple-oauth2');
var app = express();
var mysql = require('mysql');

var hbs = require('hbs');
var https = require('https');

app.set('trust proxy', 1); // trust first proxy

// -------------- express initialization -------------- //

// tell express that the view engine is hbs
app.set('view engine', 'hbs');

// serve files from the static directory (https://expressjs.com/en/starter/static-files.html)
// the following line is a directive to serve all files in all subfolders 
app.use(express.static('static'));

app.use(cookieSession({
  name: 'snorkles',
  keys: ['SomeSecretKeys123', 'ThatYouShouldChange456']
}));

// -------------- variable initialization -------------- //


var ion_client_id = 'urtwMP5rJzI1gXBPw6Jayxl1zdXN6J88lCsCUCk3';
var ion_client_secret = 'rIcwQdCB4x9vycu7TF14C85FS8jAgYCmGDWTsd7VN4CUXF1XKsQlAaT3h68UMJgPhHJEH34P99i3bWFDm0HW5dOdKvZhYYKn4Jqf3ZTAAOxtg7tyJmMGoqedDK6aarF2';
var ion_redirect_url = 'https://user.tjhsst.edu/2022agorbane/login_worker'; // you can choose this!
// http://127.0.0.1/login_worker

var client = new AuthorizationCode({
	client: {
		id: ion_client_id,
		secret: ion_client_secret,
	},
	auth: {
		tokenHost: 'https://ion.tjhsst.edu/oauth/',
		authorizePath: 'https://ion.tjhsst.edu/oauth/authorize',
		tokenPath: 'https://ion.tjhsst.edu/oauth/token/'
	}
});

// This URL takes you to the ION server and asks if you are wiling to give read permission to ION

const OAUTH_SCOPE = 'read';

var authorizationUri = client.authorizeURL({
	scope: OAUTH_SCOPE,
	redirect_url: ion_redirect_url
});

var errorBasic = "There was an error somewhere.";
var errorCurrent = errorBasic;

// -------------- MySQL initialization -------------- //
// PARAMETERS FROM DIRECTOR DOCS!!!

var sql_params = {
    connectionLimit : 10,
    user            : process.env.DIRECTOR_DATABASE_USERNAME,
    password        : process.env.DIRECTOR_DATABASE_PASSWORD,
    host            : process.env.DIRECTOR_DATABASE_HOST,
    port            : process.env.DIRECTOR_DATABASE_PORT,
    database        : process.env.DIRECTOR_DATABASE_NAME
};

var pool = mysql.createPool(sql_params);

// -------------- express 'get' handlers -------------- //

app.get('/', function(req, res){

    // render the template
    res.render('index');

});

app.get('/labs', function(req, res){
    
    errorCurrent = errorBasic;
    res.render('labs');
});

// Lab 5 about My Profile from ION

function checkAuthentication(req,res,next) {
    if('authenticated' in req.session){
        //user logged in? yes, then
        console.log("user logged in")
        next();
    }
    else{
        //user not logged in?
        console.log("user not logged in")
        res.render('unverified', {'login_link': authorizationUri});
    }
}

async function possiblyRefreshToken(req,res,next) {

    var accessToken = client.createToken(req.session.token); //recreate a token (class) instance
    if (accessToken.expired()) {
        try {
            const refreshParams = {
                'scope' : OAUTH_SCOPE,
            };
    
            req.session.token = await accessToken.refresh(refreshParams);
            console.log("token refreshed")
        } catch (error) {
            console.log('Error refreshing access token: ', error.message);
            return;
        }
    }
    next();
}

function getUserName(req,res,next) {
    //console.log(req.session.token.access_token)
    var access_token = req.session.token.access_token;
    var profile_url = 'https://ion.tjhsst.edu/api/profile?format=json&access_token='+access_token;
    
    https.get(profile_url, function(response) {
    
      var rawData = '';
      response.on('data', function(chunk) {
          rawData += chunk;
      });
    
      response.on('end', function() {
        res.locals.profile = JSON.parse(rawData);
        next(); 
      });
    
    }).on('error', function(err) {
        next(err);
    });

}

app.get('/profile', [checkAuthentication, possiblyRefreshToken, getUserName], function (req, res) {
        //return res.render('error_page', {error:'undergoing maintenance!'});
    
        var profile = res.locals.profile;
        console.log("result is")
        console.log(profile)
        var yourID = profile.id;
        var first_name = profile.first_name;
        var full_name = profile.full_name;
        var visits_count = 1;
        
        var q1 = 'SELECT visits from visitors WHERE id=' + yourID;
        
        
        pool.query(q1, function (error, results, fields) {
            if (error) throw error;
            var q2 = ""
            if(results.length===0){
                q2 = "INSERT INTO visitors (id, name, visits) VALUES (" + yourID + ", '" + full_name + "', 1)";
                pool.query(q2, function(e, r, f){
                    console.log("rendering with 1 visit")
                   res.render('verified', {'user' : first_name, 'visits':visits_count});
                })
            }
            
            else {
                q2 = 'UPDATE visitors SET visits = visits+1 WHERE id='+yourID;
  
                pool.query(q2, function(e, r, f){
                    var q3 = 'SELECT visits FROM visitors WHERE id =' + yourID;
                    console.log("rendering with multiple visits")
                    pool.query(q3, function(e2, r2, f2){
                        if (e2) throw error;
                        
                        //visit counts in the database are one more than what results gives
                        visits_count = results[0]["visits"]+1
                        console.log(visits_count)
                        res.render('verified', {'user' : first_name, 'visits':visits_count});
    
                    })
                })
                
            }
                
                


        });   
        
});

app.get('/logout', function (req, res) {
    
    delete req.session.authenticated;
    res.redirect('https://user.tjhsst.edu/2022agorbane');

});

//Lab 4 about the Fun Form

app.get('/funform', function(req, res){
	errorCurrent = "Some sort of error with the inputs on the Form.";
	res.render('funform');
});


app.get('/formresults', function(req, res){
	
	out = {
		name: req.query.name,
		story: req.query.story,
		color: req.query.color,
		pronoun: req.query.pronoun
	};

	console.log(out);


	res.render('formresults', out);
});




//Lab3 about weather

app.get('/weatherform', function(req, res){
	res.render('formdisplay');
});

app.get('/getweather', [getArray], function(req, res){

	var days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Today', 'This Afternoon'];


	array = res.locals.arrayJSON;

	var remove = [];


	for(var i=0; i < array.length; i++){
		if(!days_of_week.includes(array[i].name)){
			remove.push(i);
		}	
	}

	console.log(remove);

	for (var index = remove.length-1; index >=0; index--) {
		array.splice(remove[index], 1);
	}

	var out = {
		city: res.locals.city,
		state: res.locals.state,
		days: array
	};

	console.log(array);

	res.render('weather', out);

});


function getArray(req, res, next){

		errorCurrent = "Those latitude and longitude coordinates may be too precise, flat out not be numbers, are not on US territory, or are not measured by weather.gov.";

		var url = 'https://api.weather.gov/points/42.9356,-78.8692';

		if('lat' in req.query){

			var lat = Number(req.query.lat);
			var long = Number(req.query.long);

			url = "https://api.weather.gov/points/" + lat + "," + long;
		}

		console.log(url);
		

		var server = {headers: {
			'User-Agent': 'request'
			}
		};


		https.get(url, server, function(response) {


			var rawData = '';

			response.on('data', function(chunk) {
		    	rawData += chunk;

		    });

			response.on('end', function() {

			  obj = JSON.parse(rawData);
			  status = obj.status;

			  if(typeof status == "number"){
			  	req.arrayJSON = 'error';
			  	return next(new Error('yikes'));
			  }

			  res.locals.city = obj.properties.relativeLocation.properties.city;
  			  res.locals.state = obj.properties.relativeLocation.properties.state;


			  url2 = obj.properties.forecast;

			  			https.get(url2, server, function(response) {


							var rawData = '';

							response.on('data', function(chunk) {
						    	rawData += chunk;

						    });

							response.on('end', function() {
							  console.log(url2);
							  obj = JSON.parse(rawData);

							  res.locals.arrayJSON = obj.properties.periods;
							  next();

							});

						}).on('error', function(e){
							console.error(e);

						}).end();

			});

		}).on('error', function(e){
			console.error(e);

		}).end();

		

}

app.use(function(error, req, res, next){

  res.render('error_page', {error: errorCurrent});

});

 //Lab2 about number facts

var facts_list = [
    ['1 is not a prime nor a composite number', '1 is the number of heads people usually have', '1 is the number of legs on a centipede if 99 of its legs were chopped off'],
    ['2 is the first prime number', '2 is the number of hands people usualy have', '2 is the number of eyebrows people have if you don\'t have a unibrow'],
    ['3 is the first odd prime number', '3 is the number of years i\'ve been at TJ', '3 is the number of ears you have if you have an extra ear'],
    ['4 i the number of sides a square has', '4 is the number of legs my cat has', '4 rhymes with door and poor'],
    ['5 evenly divides all integers that end in 5 or 0', '5 is the number of sides on a pentagon', '5 is three less than the number of average hours of sleep you should get per night'],
    ['6 is the number 9 upside down', '6 is the number of sides of hexagon', 'fun fact: 6 is afraid of 7 because seven ate nine'],
    ['7 is the number of days in a week', '7 people will often beat one person in a fight', '7 looks like a 1 written with bad handwriting'],
    ['8 is the second perfect cube number after 1', '8 looks like the infinity symbol rotated 90 degrees', '8 is the number of paws Alyssa\'s two bunnies have'],
    ['9 is the number 6 upside down', '9 is the number of toes people usually have if they are missing a toe', '9 is a perfect square'],
    ['10 is the first two digit natural number', '10 is the number of fingers people usually (properly) type with', '10 is spelled out in English with three letters']
];

app.get('/lab2/:number', function(req, res){
    
    var num = Number(req.params.number);
    var out, num_facts;

    if('num_facts' in req.query){
        num_facts = Number(req.query.num_facts);
        
        if(isNaN(num_facts)){
            return res.render('error_page');
        }
        
        else if(num_facts>3){
            num_facts = 3;
        }
        
        else if(num_facts<0){
            num_facts = 0;
        }
    }
    if(num<1 || num>10){
        return res.render('error_page', {error:'your number isn\'t within the range 1- 10 !'});
    }
    
    else if(isNaN(num)){
        return res.render('error_page', {error:'no number specified. hint: put Lab2/some number between 1 and 10 in the URL. you can also specify the number of facts you want by adding ?num_facts=number, but the number of facts won\'t exceed 3. if you want to see it in json format, add &format=json or ?format=json as well.'});
    }
    
    else if (typeof num_facts === 'undefined') {

        out = {
            the_number: num,
            facts: [facts_list[num-1][0]] //take first element of the facts list
        };
    }
        
    else if(typeof(num)=='number'){
        var list = [];
        
        for(var i = 0; i<num_facts; i++){
            list.push(facts_list[num-1][i]); //add up to three facts onto the list
        }
        
        out = {
            the_number: num,
            facts: list
        };
    }
    
    console.log(out);
    
    if(req.query.format == "json"){
        return res.json(out);
    }
    
    else{
        return res.render('number_facts', out);
    }
});

// -------------- intermediary login_worker helper -------------- //

async function handleCode(req, res, next) {
    var theCode = req.query.code;

    var options = {
        'code': theCode,
        'redirect_url': ion_redirect_url,
        'scope': OAUTH_SCOPE
     };
    
    // needed to be in try/catch
    try {
        var accessToken = await client.getToken(options);      // await serializes asyncronous fcn call
        res.locals.token = accessToken.token;
        next()
    } 
    catch (error) {
        console.log('Access Token Error', error.message);
         res.send(502); // bad stuff
    }
}


app.get('/login_worker', [handleCode], function(req, res){

    req.session.authenticated = true;
    req.session.token = res.locals.token;

    res.redirect('https://user.tjhsst.edu/2022agorbane/profile');
});


// -------------- listener -------------- //
// // The listener is what keeps node 'alive.' 

var listener = app.listen(process.env.PORT || 8080, process.env.HOST || "0.0.0.0", function() {
    console.log("Express server started");
});