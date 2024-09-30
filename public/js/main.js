/**
 * Socket.io socket
 */
let socket;
/**
 * The stream object used to send media
 */
let localStream = null;
/**
 * All peer connections
 */
let peers = {}

// // redirect if not https
// if (location.href.substr(0, 5) !== 'https')
//     location.href = 'https' + location.href.substr(4, location.href.length - 4)


//////////// CONFIGURATION //////////////////

/**
 * RTCPeerConnection configuration 
 */

const configuration = {
    // Using From https://www.metered.ca/tools/openrelay/
    iceServers: [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: "20f33d829b206e51dbf6e56a",
            credential: "+zzjhAN1Xnc2SdnZ",
        },
        {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "20f33d829b206e51dbf6e56a",
            credential: "+zzjhAN1Xnc2SdnZ",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: "20f33d829b206e51dbf6e56a",
            credential: "+zzjhAN1Xnc2SdnZ",
        },
        {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "20f33d829b206e51dbf6e56a",
            credential: "+zzjhAN1Xnc2SdnZ",
        },
    ],
}

/**
 * UserMedia constraints
 */
let constraints = {
    audio: false,
    video: {
        width: {
            max: 300
        },
        height: {
            max: 300
        }
    }
}

/////////////////////////////////////////////////////////

constraints.video.facingMode = {
    ideal: "user"
}

/////////////////////////////////////////////
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const room = urlParams.get('room');

if (room) {

    // enabling the camera at startup
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        console.log('Received local stream');

        localVideo.srcObject = stream;
        localVideo.className = " absolute z-10 bottom-[5px] right-[5px] h-[150px] rounded-lg shadow-xl overflow-auto resize";
        localStream = stream;

        init()

    }).catch(e => alert(`getusermedia error ${e.name}`))

    // audio
    const audio = document.getElementById("audio");
    const audioFileInput = document.getElementById("audioFileInput");
    const playPauseButton = document.getElementById("play-pause-button");


    // video
    const videoFileInput = document.getElementById('videoFileInput');
    const videoPlayer = document.getElementById('videoPlayer');
    let isPlaying = false;

    playPauseButton.addEventListener("click", () => {

        if (videoPlayer.src && audio.src)
            if (isPlaying) {
                audio.pause();
                playPauseButton.textContent = "Play";
                videoPlayer.pause();
            } else {
                audio.play();
                videoPlayer.play();
                playPauseButton.textContent = "Pause";
            }
        isPlaying = !isPlaying;
    });

    audioFileInput && audioFileInput.addEventListener('change', function (event) {
        const file = event.target.files[0];
        const url = URL.createObjectURL(file);
        audio.src = url;
        audio.load();
    });

    audio.addEventListener('play', () => {
        var audioStream = audio.captureStream();
        localVideo.srcObject = null
        for (let socket_id in peers) {
            console.log(peers[socket_id].streams[0].getTracks());
            for (let index in [1]) {

                if (peers[socket_id].streams[0].getTracks()[index].kind === audioStream.getTracks()[0].kind) {
                    peers[socket_id].addTrack(audioStream.getTracks()[0], peers[socket_id].streams[0])
                    break;
                }
            }
        }

        localStream = audioStream
        localVideo.srcObject = audioStream

        updateButtons()
    });

    // Khi người dùng chọn một video
    videoFileInput && videoFileInput.addEventListener('change', function (event) {
        const file = event.target.files[0];
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoPlayer.load();
    });

    videoPlayer.addEventListener('play', () => {
        console.log("playing video...");

        var videoStream = videoPlayer.captureStream();

        localVideo.srcObject = null

        for (let socket_id in peers) {
            for (let index in peers[socket_id].streams[0].getTracks()) {
                if (peers[socket_id].streams[0].getTracks()[index].kind === videoStream.getTracks()[0].kind) {
                    peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], videoStream.getTracks()[0], peers[socket_id].streams[0])
                    break;
                }
            }
        }

        localStream = videoStream
        localVideo.srcObject = videoStream

        updateButtons()
    });
}

/**
 * initialize the socket connections
 */
function init() {
    socket = io()

    socket.on('initReceive', socket_id => {
        console.log('INIT RECEIVE ' + socket_id)
        addPeer(socket_id, false)

        socket.emit('initSend', socket_id)
    })

    socket.on('initSend', socket_id => {
        console.log('INIT SEND ' + socket_id)
        addPeer(socket_id, true)
    })

    socket.on('removePeer', socket_id => {
        console.log('removing peer ' + socket_id)
        removePeer(socket_id)
    })

    socket.on('disconnect', () => {
        console.log('GOT DISCONNECTED')
        for (let socket_id in peers) {
            removePeer(socket_id)
        }
    })

    socket.on('signal', data => {
        peers[data.socket_id].signal(data.signal)
    })
}

/**
 * Remove a peer with given socket_id. 
 * Removes the video element and deletes the connection
 * @param {String} socket_id 
 */
function removePeer(socket_id) {

    let videoEl = document.getElementById(socket_id)
    if (videoEl) {

        const tracks = videoEl.srcObject.getTracks();

        tracks.forEach(function (track) {
            track.stop()
        })

        videoEl.srcObject = null
        videoEl.parentNode.removeChild(videoEl)
    }
    if (peers[socket_id]) peers[socket_id].destroy()
    delete peers[socket_id]
}

/**
 * Creates a new peer connection and sets the event listeners
 * @param {String} socket_id 
 *                 ID of the peer
 * @param {Boolean} am_initiator 
 *                  Set to true if the peer initiates the connection process.
 *                  Set to false if the peer receives the connection. 
 */
function addPeer(socket_id, am_initiator) {
    peers[socket_id] = new SimplePeer({
        initiator: am_initiator,
        stream: localStream,
        config: configuration
    })

    peers[socket_id].on('signal', data => {
        socket.emit('signal', {
            signal: data,
            socket_id: socket_id
        })
    })

    peers[socket_id].on('stream', stream => {
        let newVid = document.createElement('video')
        newVid.srcObject = stream
        newVid.id = socket_id
        newVid.playsinline = false
        newVid.autoplay = true
        newVid.className = "vid"
        newVid.onclick = () => openPictureMode(newVid)
        newVid.ontouchstart = (e) => openPictureMode(newVid)
        videos.appendChild(newVid)
    })
}

/**
 * Opens an element in Picture-in-Picture mode
 * @param {HTMLVideoElement} el video element to put in pip mode
 */
function openPictureMode(el) {
    console.log('opening pip')
    el.requestPictureInPicture()
}

/**
 * Switches the camera between user and environment. It will just enable the camera 2 cameras not supported.
 */
function switchMedia() {
    if (constraints.video.facingMode.ideal === 'user') {
        constraints.video.facingMode.ideal = 'environment'
    } else {
        constraints.video.facingMode.ideal = 'user'
    }

    const tracks = localStream.getTracks();

    tracks.forEach(function (track) {
        track.stop()
    })

    localVideo.srcObject = null
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {

        for (let socket_id in peers) {
            for (let index in peers[socket_id].streams[0].getTracks()) {
                for (let index2 in stream.getTracks()) {
                    if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                        peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], stream.getTracks()[index2], peers[socket_id].streams[0])
                        break;
                    }
                }
            }
        }

        localStream = stream
        localVideo.srcObject = stream

        updateButtons()
    })
}

/**
 * Enable screen share
 */
function setScreen() {
    console.log("Set screen");

    navigator.mediaDevices.getDisplayMedia().then(stream => {
        for (let socket_id in peers) {
            for (let index in peers[socket_id].streams[0].getTracks()) {
                for (let index2 in stream.getTracks()) {
                    if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                        peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], stream.getTracks()[index2], peers[socket_id].streams[0])
                        break;
                    }
                }
            }

        }
        localStream = stream

        localVideo.srcObject = localStream
        socket.emit('removeUpdatePeer', '')
    })
    updateButtons()
}

/**
 * Disables and removes the local stream and all the connections to other peers.
 */
function removeLocalStream() {
    if (localStream) {
        const tracks = localStream.getTracks();

        tracks.forEach(function (track) {
            track.stop()
        })

        localVideo.srcObject = null
    }

    for (let socket_id in peers) {
        removePeer(socket_id)
    }
}

/**
 * Enable/disable microphone
 */
function toggleMute() {
    for (let index in localStream.getAudioTracks()) {
        localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled
        muteButton.innerText = localStream.getAudioTracks()[0].enabled ? "Muted" : "Unmuted"
    }
}

/**
 * Enable/disable video
 */
function toggleVid() {
    for (let index in localStream.getVideoTracks()) {
        localStream.getVideoTracks()[index].enabled = !localStream.getVideoTracks()[index].enabled
        vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled"
    }
}

/**
 * updating text of buttons
 */
function updateButtons() {
    for (let index in localStream.getVideoTracks()) {
        vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled"
    }
    for (let index in localStream.getAudioTracks()) {
        muteButton.innerText = localStream.getAudioTracks()[index].enabled ? "Unmuted" : "Muted"
    }
}

//Make the DIV element draggagle:
dragElement(document.getElementById("localVideo"));

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id)) {
        /* if present, the header is where you move the DIV from:*/
        document.getElementById(elmnt.id).onmousedown = dragMouseDown;
    } else {
        /* otherwise, move the DIV from anywhere inside the DIV:*/
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        let screenX = window.innerWidth;
        let screenY = window.innerHeight;

        // calculate the new cursor position:
        if (e.clientX >= 0 && e.clientX <= screenX && e.clientY >= 0 && e.clientY <= screenY - 50) {
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // set the element's new position:
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }
    }

    function closeDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}