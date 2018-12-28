//TODO: IIFE wrap
//(function() {
    //'use strict';

    function firebaseInit() {
        // Initialize Firebase
        // TODO: Replace with your project's customized code snippet
        var config = {
            apiKey: "AIzaSyDM4pDrW45smJa85VZ3MwAi4BbouF7b-vM",
            authDomain: "beeb-music.firebaseapp.com",
            databaseURL: "https://beeb-music.firebaseio.com",
            projectId: "beeb-music",
            storageBucket: "",
            messagingSenderId: "98670089254"
        };
        firebase.initializeApp(config);

        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in.
                var isAnonymous = user.isAnonymous;
                var uid = user.uid;

                dbInitCounts();

                // ...
                //alert("user signed in, isAnonymous=" + isAnonymous + " uid=" + uid);
            } else {
                // User is signed out.
                // ...
                //alert("user signed out");
                myLogin();
            }
            // ...
        });   

        // login as anonymous user (for now)
        if (firebase.auth().currentUser === null) {
            myLogin();
        }            
    }


    var playerControls;
    var songDisplay;


    // configure what music infos to display in SongDisplay
    VGMDisplayAccessor = (function(){ var $this = function (doGetSongInfo) {
            $this.base.call(this, doGetSongInfo);
        }; 
        extend(DisplayAccessor, $this, {
            getDisplayTitle: function() 	{ return this.getSongInfo().title;},
            getDisplaySubtitle: function() 	{ return this.getSongInfo().author;},
            getDisplayLine1: function() { return this.getSongInfo().comment;},
            getDisplayLine2: function() { return this.getSongInfo().program; },
            getDisplayLine3: function() { return ""; }
        });	return $this; })();
            
    // link player events to "controls" and "display"
    function doOnTrackEnd(){
        //if (playerControls) playerControls.playNextSong();  
    }
    function doOnTrackReadyToPlay(){ 	
        ScriptNodePlayer.getInstance().play();
        songDisplay.redrawSongInfo();
    }
    var vgmPlayerReady = false;
    function doOnPlayerReady() {
        // dont auto start
        //if (playerControls) playerControls.playNextSong();
        vgmPlayerReady = true;
        if (songQueued != null)
            localPlaySong(songQueued);
    }

    var vgmInitialised = false;
    function vgmInit() {

        if (vgmInitialised)
            return;

        // --------------------------- VGM music player -----------------------
        var basePath= '';		// not needed here
        ScriptNodePlayer.createInstance(new VgmBackendAdapter(), basePath, ["VGMPlay.ini", "yrw801.rom"], true,
                                            doOnPlayerReady, doOnTrackReadyToPlay, doOnTrackEnd);
            
        playerControls= new BasicPlayerControls(songs, true, false,
                    (function(someSong) {
                        var arr= someSong.split(";");	
                        var boostVolume= arr.length>1?parseInt(arr[1]):0;		
                        var url= arr[0];
                        
                        var options= {};
                        options.track= 0;// archives are not supported and *.vgz/*.vgm contain always 1 track
                        options.boostVolume= boostVolume;
                        return [url, options];
                    }),
                    0
                );

        var yellow= 0xf4cb25;
        var red= 0xef210a;
        var blue= 0x1b1088;
        var purple= 0x630f64;
        
        songDisplay= new SongDisplay(new VGMDisplayAccessor((function(){return playerControls.getSongInfo();})), 
                                    [yellow, red, purple, blue, blue], 1, 0.1, (function(){playerControls.animate()}));

        // dont auto play
        //playerControls.playNextSong();

        vgmInitialised = true;
    }

    var selectedSong = null;
    var songPlayPending = false;
    var songQueued = null;
    // where songName is the content URL (not the site URL)
    function myPlaySong(songName)
    {
        songQueued = songName;
        if (!vgmInitialised)
            vgmInit();

        if (!vgmPlayerReady)
            return;

        localPlaySong(songName);
    }

        

    function localPlaySong(songName)
    {
        var item;

        if (selectedSong != null && selectedSong == songName) {
            item = document.getElementById(selectedSong +  "/playButton");
            if (item.classList.contains("fa-play")) {
                playerControls.resume();
                item.classList.remove("fa-play");
                item.classList.add("fa-pause");
            }else
            {
                if (item.classList.contains("fa-pause"))
                    playerControls.pause();

                item.classList.remove("fa-pause");
                item.classList.add("fa-play");
            }
            return;
        }

        if (selectedSong != null)
        {
            item = document.getElementById(selectedSong);
            item.removeAttribute("class", "is-selected");	    
            
            item = document.getElementById(selectedSong +  "/playButton");
            item.classList.remove("fa-pause");
            item.classList.add("fa-play");

        }

        item = document.getElementById(songName);
        item.setAttribute("class", "is-selected");	

        item = document.getElementById(songName +  "/playButton");
        item.classList.remove("fa-play");
        item.classList.add("fa-pause");


        selectedSong = songName;	

        playerControls.playSong(site_baseurl + songName);
        songPlayPending = true;
        songQueued = null; 
    }

    function myRegisterSongPlay()
    {
        if ((selectedSong != null) && songPlayPending) {

            dbAddPlay(selectedSong);
            songPlayPending = false;
        }
    }

    // Firebase keys cannot contain ., $, #, [, ], /
    function dbSongId(songName)
    {
        var db_id = songName;
        db_id = db_id.replace(/\./g, "%2E");
        db_id = db_id.replace(/\$/g, "%23");
        db_id = db_id.replace(/\#/g, "%24");
        db_id = db_id.replace(/\[/g, "%5B");
        db_id = db_id.replace(/\]/g, "%5D");
        return db_id;
    }


    function dbAddPlay(songName)
    {          
        var database = firebase.database();
        const counterRef = database.ref(dbSongId(songName) + "/playCount").transaction(current => { return (current || 0) + 1; });
    }

    function dbUpdatePlayCount()
    {

    }

    function dbGetPlays(songName)
    {
        var dbId = dbSongId(songName)
        var countRef = firebase.database().ref(dbId + "/playCount");
        countRef.on('value', function(snapshot) {
            dbUpdatePlayCount(songName, snapshot.val());
        });
    }

    // assumes user is logged in
    function dbInitCounts()
    {
        for (var i = 0; i < songs.length; i++) {
            var songName = songs[i];

            var dbId = dbSongId(songName)

            // playcounts
            var dbRef = firebase.database().ref(dbId + "/playCount");
            //dbRef.on('value', snap => playCount.innerText = snap.val());
            dbRef.on('value', function(snapshot) {

            // Now simply find the parent and return the name.
            //var parname = snapshot.ref.parent.key;
            var ref = snapshot.ref.path.toString();

            var playCount = document.getElementById(ref);
            if ((playCount != null) && (snapshot.val() != undefined))
                playCount.innerHTML = snapshot.val();              
            });            

            // likes
            var dbRef = firebase.database().ref(dbId + "/likeCount");
            dbRef.on('value', function(snapshot) {

            // Now simply find the parent and return the name.
            //var parname = snapshot.ref.parent.key;
            var ref = snapshot.ref.path.toString();
            var count = document.getElementById(ref);
            if (count != null)
            {
                if (snapshot.val() == undefined) {
                //count.innerHTML = '';    
                }else{
                count.innerHTML = snapshot.val();    
                }
            }

            });               

            // user likes - we're watching these for changes
            var dbRef = firebase.database().ref("/users/" + firebase.auth().currentUser.uid + "/likes/content/vgm");
            dbRef.on('value', function(snapshot) {

            var v = snapshot.val(); 

            for (var p in v) {
                if (v.hasOwnProperty(p)) {

                    var ref = "/content/vgm/" + p + "/likeStatus";
                    var e = document.getElementById(ref);
                    if (e != null)
                    {
                    if (v[p]) {
                        e.classList.add('is-danger');
                        e.classList.remove('is-dark');
                        e.classList.remove('is-outlined');
                    }else{
                        e.classList.remove('is-danger');
                        e.classList.add('is-dark');
                        e.classList.add('is-outlined');
                    }
                    }                    

                }
            }              

            });               


            //Do something
        }

    }



    function dbLike(songName)
    {
        if (firebase.auth().currentUser !== null) {
            db_id = dbSongId(songName);
            var dbRef = firebase.database().ref(db_id);
            dbRef.transaction(function(ref) {
            if (ref != null) {
                var uid = firebase.auth().currentUser.uid;
                if (!ref.hasOwnProperty("likes") || !ref.hasOwnProperty("likeCount")) {
                    ref.likes = [];
                    ref.likeCount = 0;
                }   
                
                if (ref.likes[uid]) {
                    ref.likeCount--;
                    ref.likes[uid] = false;
                }else {
                    ref.likeCount++;
                    ref.likes[uid] = true;
                }

                var o = '{ "' + db_id + '":' + ref.likes[uid] + '}';
                firebase.database().ref("/users/" + uid + "/likes").update(JSON.parse(o));
                return ref;
            }else{
                return {};
            }

            });


        }
    }


    function myLogin()
    {
        firebase.auth().signInAnonymously().catch(function(error) {
            // Handle Errors here.
            var errorCode = error.code;
            var errorMessage = error.message;
            //alert(errorMessage);
            // ...
        });          
    }




      //-------------------------
      // main
      // <body onload>
      //-------------------------
  
    document.addEventListener('DOMContentLoaded', event => {

      firebaseInit();
      //vgmInit();
        
    });
//})();