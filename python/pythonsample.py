import os
# Add required SDK components from quickstart here
from azure.communication.callautomation import CallAutomationClient, ServerCallLocator, CallInvite, CommunicationUserIdentifier

from flask import Flask, jsonify, request
app = Flask(__name__)
import uuid
# ...
cstring = "endpoint"
ngrok_endpoint = "https://7c1a-2001-569-5146-9600-4c59-841c-7c06-4c9e.ngrok.io"
recordingId=""
callAutomationClient = CallAutomationClient.from_connection_string(cstring)
rec_id = ""
delete_location=""
content_location=""

# Start a call manually and call start recording
@app.route('/startcall', methods=['GET'])
def process_startcall():
    print("starting new call")
    global ngrok_endpoint
    # target endpoint for ACS User
    user = CommunicationUserIdentifier("8:acs:7ae3cf22-5625-409e-948e-df4e6edd9938_00000018-c34e-b8d0-7bfa-553a0d0024e4")

    # make invitation
    call_invite = CallInvite(target=user)
    callAutomationClient.create_call(call_invite, ngrok_endpoint+"/startrecording")

    return '', 200

@app.route('/startrecording', methods=['POST'])
def process_startrecording():
    print("starting recording")

    global ngrok_endpoint
    json = request.get_json(force=True)
    print(json)
    global recordingId
    for event in json:
        if event['type'] == "Microsoft.Communication.CallConnected":
            locator = event['data']['serverCallId']
            call_locator = ServerCallLocator(server_call_id=locator)
            recording_state_result=callAutomationClient.start_recording(call_locator=call_locator, recording_state_callback_url=ngrok_endpoint+"/download")
            recordingId=recording_state_result.recording_id
            return '', 200
    return '', 200

@app.route('/download', methods=['POST'])
def process_download():
    print("download endpoint")

    json = request.get_json(force=True)
    global recordingId
    global content_location
    global delete_location

    for event in json:
        if 'type' in event:
           eventName=event['type']
        if 'eventType' in  event:
            eventName=event['eventType']
        if eventName == "Microsoft.EventGrid.SubscriptionValidationEvent":
            data = {'ValidationResponse': event['data']['validationCode']}
            return jsonify(data), 200
        if eventName == "Microsoft.Communication.RecordingFileStatusUpdated":
            content_location = event['data']['recordingStorageInfo']['recordingChunks'][0]['contentLocation']
            delete_location = event['data']['recordingStorageInfo']['recordingChunks'][0]['deleteLocation']
            return '', 200

    return '', 200


@app.route('/pause', methods=['GET'])
def process_pause():
    global recordingId
    callAutomationClient.pause_recording(recordingId)

    return '', 200

@app.route('/resume', methods=['GET'])
def process_resume():
    global recordingId
    callAutomationClient.resume_recording(recordingId)

    return '', 200

@app.route('/stop', methods=['GET'])
def process_stop():
    global recordingId
    callAutomationClient.stop_recording(recordingId)

    return '', 200

@app.route('/downloadfile', methods=['GET'])
def process_downloadfile():
    global content_location
    stream = callAutomationClient.download_recording(content_location)

    with open('downloadStream.wav', 'wb') as writer:
        writer.write(stream.read())
    
    return '', 200

@app.route('/delete', methods=['GET'])
def process_deletefile():
    global delete_location
    callAutomationClient.delete_recording(delete_location)

    return '', 200

if __name__ == "__main__":
    app.run()