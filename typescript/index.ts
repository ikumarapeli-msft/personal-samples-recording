import { CallLocator, RecordingStateResult } from "@azure/communication-call-automation";
import { CallAutomationClient, CallInvite, StartRecordingOptions } from "@azure/communication-call-automation";
import { CommunicationUserIdentifier } from "@azure/communication-common";

process.on('uncaughtException', function (err) {
  console.error(err);
  console.log("Node NOT Exiting...");
});


// setup server
const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());
const port = 5000; // default port to listen
const ngrokEndpoint = "https://7c1a-2001-569-5146-9600-4c59-841c-7c06-4c9e.ngrok.io"; //run ngrok for the selected port ./ngrok http 5000


let recID = ""; // store recording id to easily test other recoridng functions with curl commands
let deleteLocation = ""; // store recording delete location
let contentLocation = ""; // store recording download location


// Input your connection string here 
let cstring = "endpoint";
const client = new CallAutomationClient(cstring);


// Start a call manually and call start recording
app.get( "/startcall", ( req:Request, res ) => {
  console.log("starting new call");
  var user:CommunicationUserIdentifier = {communicationUserId:"8:acs:7ae3cf22-5625-409e-948e-df4e6edd9938_00000018-c34e-b8d0-7bfa-553a0d0024e4"};
  // Use this site for testing adn generating user for call https://acs-sample-app.azurewebsites.net/
  var invite:CallInvite = {targetParticipant:user};
  client.createCall(invite, ngrokEndpoint+"/startrecording");
  res.sendStatus(200);
});


// Start recording when call connected
app.post('/startrecording', async (req, res) => {
    console.log("start recording");

    for (var events in req.body) {
        var body = req.body[events];
        console.log(body.type) 

        // Deserialize the event data into the appropriate type based on event type
        if(body.type=="Microsoft.Communication.CallConnected") {
            console.log(req.body); // If the request has Content-Type application/json, the body will be parsed as JSON.
            const loc : CallLocator = { id:body.data.serverCallId, kind:"serverCallLocator"}
            const recOptions : StartRecordingOptions =  { 
                recordingStateCallbackEndpointUrl:  ngrokEndpoint+"/download",
                callLocator: loc, recordingChannel:"unmixed",
                recordingFormat:"wav",
                recordingContent:"audio" 
            }

            var recordingStateResult:RecordingStateResult =  await client.getCallRecording().start(recOptions);     
            recID = recordingStateResult.recordingId||"";
            console.log("recording id is:"+recID)
        }
    }
    res.sendStatus(200);
})


// Answer and incoming call and start recording
app.post( "/call", ( req:Request, res ) => {
    console.log("answering call");
    var validationEventType = "Microsoft.EventGrid.SubscriptionValidationEvent";
    for (var events in req.body) {
        var body = req.body[events];
        // Deserialize the event data into the appropriate type based on event type
        if (body.data && body.eventType == validationEventType) {
          console.log("Got SubscriptionValidation event data, validation code: " + body.data.validationCode + " topic: " + body.topic);
            // Do any additional validation (as required) and then return back the below response
            var code = body.data.validationCode;
            res.status(200).send({ "ValidationResponse": code });
        }

        if(body.data && body.eventType == "Microsoft.Communication.IncomingCall"){
            var incomingCallContext = body.data.incomingCallContext;
            var callbackUri = ngrokEndpoint+"/startrec";
            client.answerCall(incomingCallContext,callbackUri);
            res.sendStatus(200);
        };
    }
});


// Test core recording apis
app.get( "/pause", ( req, res ) => {
    console.log("pause recording");
    client.getCallRecording().pause(recID);
    res.sendStatus(200);
} );


app.get( "/stop", ( req, res ) => {
  console.log("stop recording");
  client.getCallRecording().stop(recID);
  res.sendStatus(200);
} );


app.get( "/resume", ( req, res ) => {
  console.log("resume recording");
  client.getCallRecording().resume(recID);
  res.sendStatus(200);
} );


app.post('/download', (req, res) => {
    console.log("download recording callback");

    var validationEventType = "Microsoft.EventGrid.SubscriptionValidationEvent";

    for (var events in req.body) {
        var body = req.body[events];
        console.log(req.body);
        console.log(events);

        // Deserialize the event data into the appropriate type based on event type
        if (body.data && body.eventType == validationEventType) {
            console.log("Got SubscriptionValidation event data, validation code: " + body.data.validationCode + " topic: " + body.topic);
            // Do any additional validation (as required) and then return back the below response
            var code = body.data.validationCode;
            res.status(200).send({ "ValidationResponse": code });
        }

        if(body.data && body.eventType == "Microsoft.Communication.RecordingFileStatusUpdated") {
            deleteLocation = body.data.recordingStorageInfo.recordingChunks[0].deleteLocation
            contentLocation = body.data.recordingStorageInfo.recordingChunks[0].contentLocation
            console.log("Delete Location: " + deleteLocation);
            console.log("Content Location: " + contentLocation);
            res.sendStatus(200);
        }
    }
})


// delete recording 
app.get( "/deleterecording", async ( req, res ) => {

    console.log("delete recording");
    client.getCallRecording().delete(deleteLocation).catch(error => {
        console.log(error)
    });
  res.sendStatus(200);
});
 

// download file
app.get( "/downloadfile", async ( req, res ) => {

    console.log("downloading recording");
    var stream = await client.getCallRecording().downloadStreaming(contentLocation).catch(error => {
      console.log(error);
    })

    if(stream){
        stream.pipe(fs.createWriteStream('downloadStream.wav'));
    }
    res.sendStatus(200);
} );


app.listen(port, () => {console.log("listening on:" + port)});