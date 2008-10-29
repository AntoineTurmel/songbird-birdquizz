// Shorthand
if (typeof(Cc) == "undefined")
    var Cc = Components.classes;
if (typeof(Ci) == "undefined")
    var Ci = Components.interfaces;
if (typeof(Cu) == "undefined")
    var Cu = Components.utils;
if (typeof(Cr) == "undefined")
    var Cr = Components.results;
    
if ("sbIMediacoreManager" in Components.interfaces)
    // new Media Core API (>= 0.8.0pre)
    var gMM = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]
                .getService(Ci.sbIMediacoreManager);
else
    var gPPS = Cc["@songbirdnest.com/Songbird/PlaylistPlayback;1"]
                 .getService(Ci.sbIPlaylistPlayback);

if (typeof(gIOS) == "undefined")
    var gIOS = Cc["@mozilla.org/network/io-service;1"]
                 .createInstance(Ci.nsIIOService);

/**
 * Media Page Controller
 *
 * In order to display the contents of a library or list, pages
 * must provide a "window.mediaPage" object implementing
 * the Songbird sbIMediaPage interface. This interface allows
 * the rest of Songbird to talk to the page without knowledge
 * of what the page looks like.
 *
 * In this particular page most functionality is simply
 * delegated to the sb-playlist widget.
 */
window.mediaPage = {

    // The sbIMediaListView that this page is to display
  _mediaListView: null,

    // The sb-playlist XBL binding
  _playlist: null,

  /**
   * Gets the sbIMediaListView that this page is displaying
   */
  get mediaListView()
  {
    return this._mediaListView;
  },

  /**
   * Set the sbIMediaListView that this page is to display.
   * Called in the capturing phase of window load by the Songbird browser.
   * Note that to simplify page creation mediaListView may only be set once.
   */
  set mediaListView(value)
  {
    if (!this._mediaListView)
        this._mediaListView = value;
    else
        throw new Error("mediaListView may only be set once. " +
                        "Please reload the page");
  },

  set startPosition(value) { this._startPos = value; },
  get choices() { return this._choices; },
  get maxRounds() { return this._maxRounds; },
  get rounds() { return this._rounds; },
  get score() { return this._score; },
  get startPosition() { return this._startPos; },
  set choices(value) { this._choices = value; },
  set maxRounds(value) { this._maxRounds = value; },
  set rounds(value) { this._rounds = value; },
  set score(value) { this._score = value; },

  /**
   * Called when the page finishes loading.
   * By this time window.mediaPage.mediaListView should have
   * been externally set.
   */
  onLoad: function(e)
  {
    // Make sure we have the JavaScript modules we're going to use
    if (!window.SBProperties)
        Cu.import("resource://app/jsmodules/sbProperties.jsm");
    if (!window.LibraryUtils)
        Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
    if (!window.kPlaylistCommands)
        Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

    if (!this._mediaListView)
    {
        Cu.reportError("Media Page did not receive a mediaListView before " +
                       "the onload event!");
        return;
    }

    // Hide the playlist
    this._playlist = document.getElementById("playlist");
    this._playlist.hidden = true;

    this._strings = document.getElementById("birdquizz-strings");

    // Hide the currently playing track info in the faceplate
    this.mainWin = Cc["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Ci.nsIWindowMediator)
                     .getMostRecentWindow("Songbird:Main").window;
    this.trackInfoBox = this.mainWin.document.getElementById("track_info");
    this.trackInfoBox.style.visibility = "hidden";

    this.readPrefs();
    this.rounds = this.maxRounds;
    this.score = 0;
    this.startPosition = 30000;

    // Get playlist commands (context menu, keyboard shortcuts, toolbar)
    // Note: playlist commands currently depend on the playlist widget.
    var mgr = Cc["@songbirdnest.com/Songbird/PlaylistCommandsManager;1"]
                .createInstance(Ci.sbIPlaylistCommandsManager);
    var cmds = mgr.request(kPlaylistCommands.MEDIAITEM_DEFAULT);

    // Set up the playlist widget
    this._playlist.bind(this._mediaListView, cmds);
  },

  /**
   * Called as the window is about to unload
   */
  onUnload: function(e)
  {
    // Restore the currently playing track info in the faceplate
    this.trackInfoBox.style.visibility = "visible";

    if (this._playlist)
    {
      this._playlist.destroy();
      this._playlist = null;
    }
  },

  /**
   * Show/highlight the MediaItem at the given MediaListView index.
   * Called by the Find Current Track button.
   */
  highlightItem: function(aIndex)
  {
    this._playlist.highlightItem(aIndex);
  },

  /**
   * Called when something is dragged over the tabbrowser tab for this window
   */
  canDrop: function(aEvent, aSession)
  {
    return this._playlist.canDrop(aEvent, aSession);
  },

  /**
   * Called when something is dropped on the tabbrowser tab for this window
   */
  onDrop: function(aEvent, aSession)
  {
    return this._playlist
               ._dropOnTree(this._playlist.mediaListView.length,
                            Ci.sbIMediaListViewTreeViewObserver.DROP_AFTER);
  },

  createButtons: function()
  {
    var choicesGroupBox = document.getElementById("choices-group-box");
    choicesGroupBox.hidden = false;

    var choice;
    var choicesBox = document.getElementById("choices-box");
    this.readPrefs();

    for (var i = 0; i < this.choices; i++)
    {
        choice = document.createElement("button");
        choice.setAttribute("id", "choice" + i.toString());
        choice.setAttribute("label", "");
        choice.setAttribute("onclick", "window.mediaPage.selectAnswer(event);");
        choicesBox.appendChild(choice);
    }
  },

  deleteButtons: function()
  {
    var scoreLabel = document.getElementById("score-label");
    scoreLabel.hidden = true;
    var scoreBox = document.getElementById("score");
    scoreBox.hidden = true;
    var choicesGroupBox = document.getElementById("choices-group-box");
    var choicesBox = document.getElementById("choices-box");
    if (!choicesGroupBox || !choicesBox)
        return;
    choicesGroupBox.hidden = true;
    while (choicesBox.hasChildNodes())
        choicesBox.removeChild(choicesBox.firstChild);
  },

  endQuiz: function()
  {
    this.showFinalScore();
    this.trackSamplePlayback("stop");
    this.readPrefs();
    this.rounds = this.maxRounds;
    this.score = 0;
    var scoreLabel = document.getElementById("score-label");
    scoreLabel.hidden = true;
    var scoreBox = document.getElementById("score");
    scoreBox.hidden = true;
    scoreBox.setAttribute("value", 0);
    var stop = document.getElementById("stop");
    if (stop)
    {
        stop.setAttribute("id", "start");
        stop.setAttribute("label", this._strings.getString("start"));
    }
    this.deleteButtons();
  },

  readPrefs: function()
  {
    // Preferences
    const prefchoices = "extensions.birdquizz.choices";
    const prefmaxRounds = "extensions.birdquizz.maxRounds";
    const playwith = "extensions.birdquizz.playwith";
    const enablesound = "extensions.birdquizz.sound";
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch2);

    this.choices = prefs.getCharPref(prefchoices);
    this.maxRounds = prefs.getCharPref(prefmaxRounds);
    this.playwith = prefs.getCharPref(playwith);
    this.enablesound = prefs.getBoolPref(enablesound);
  },

  selectAnswer: function(e)
  {
    var answer = (e.target).getAttribute("url");
    var currentTrack;
    var position;

    if ("sbIMediacoreManager" in Components.interfaces)
    {
        // new Media Core API (>= 0.8.0pre)
        currentTrack = gMM.playbackControl.uri.spec;
        position = gMM.playbackControl.position;
        gMM.playbackControl.stop();
    }
    else
    {
        // old PlaylistPlaybackService API
        currentTrack = gPPS.currentURL;
        position = gPPS.position;
        gPPS.stop();
    }

    if (this.enablesound)
    {
        // sound implementation
        var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound)
        var ios = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);
        var url = "chrome://birdquizz/content/";
        url += (answer == currentTrack) ? "correct.wav" : "bad.wav";
        var uri = ios.newURI(url, null, null)
                     .QueryInterface(Ci.nsIURL);
        sound.init();
        sound.play(uri);
    }

    if (answer == currentTrack)
    {
        // var score = position ? Math.round(16000 / (position - this.startPosition)) : 0;
        var score = position ? Math.round(16000 / position) : 0;
        this.score += score;
        var scoreBox = document.getElementById("score");
        scoreBox.setAttribute("value", this.score);
    }

    this.setButtons();
  },

  setButtons: function()
  {
    if (this.rounds <= 0)
    {
        this.endQuiz();
        return;
    }

    // Make sure we have the JavasSript modules we're going to use
    if (!window.SBProperties)
      Cu.import("resource://app/jsmodules/sbProperties.jsm");
    if (!window.LibraryUtils)
      Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
    if (!window.kPlaylistCommands)
      Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

    if (!this._mediaListView)
    {
      Cu.reportError("Media Page did not receive a mediaListView before the " +
                     "onload event!");
      return;
    }

    var listener = {
        trackList : null,
        onEnumerationBegin : function(list) {
            this.trackList = new Array()
        },
        onEnumeratedItem : function(list, item) {
            this.trackList.push(item);
        },
        onEnumerationEnd : function(list) { }
    };
    this.mediaListView.mediaList.enumerateItemsByProperty(SBProperties.isList,
                                                          0, listener);

    var artist, track, r;
    var artistList = ["Various"]; // Put undesirable artist values here.
    var rTrackList = new Array();
    var tracks = listener.trackList.length;

    for (var i = 0; i < tracks; i++)
    {
        r = Math.round(Math.random() * (listener.trackList.length - 1));
        track = listener.trackList[r];
        listener.trackList.splice(r, 1);
        artist = track.getProperty(SBProperties.artistName);
        if ((this.playwith == "playartist") && artist &&
            (artistList.indexOf(artist) == -1))
        {
            artistList.push(artist);
            rTrackList.push(track);
        }
        else if (this.playwith == "playtitle")
        {
            rTrackList.push(track);
        }
    }

    if (rTrackList.length < this.choices)
    {
        this.showInsufficientMediaWarning();
        this.trackSamplePlayback("stop");
        this.readPrefs();
        this.rounds = this.maxRounds;
        this.score = 0;
        var scoreBox = document.getElementById("score");
        scoreBox.setAttribute("value", 0);
        var stop = document.getElementById("stop")
        if (stop)
        {
            stop.setAttribute("id", "start");
            stop.setAttribute("label", this._strings.getString("start"));
        }
        this.deleteButtons();
        return;
    }

    var node = document.getElementById("choice0");
    if (!node)
    {
        this.createButtons();
        var scoreLabel = document.getElementById("score-label");
        scoreLabel.hidden = false;
        var scoreBox = document.getElementById("score");
        scoreBox.hidden = false;
        scoreBox.setAttribute("value", " 0 ");
        var start = document.getElementById("start");
        start.setAttribute("id", "stop");
        start.setAttribute("label", this._strings.getString("stop"));
    }

    var choice, labelType, playwith;
    var buttons = new Array();

    // Set the buttons
    for (var i = 0; i < this.choices; i++)
    {
        choice = document.getElementById("choice" + i.toString());
        track = rTrackList[i];
        playwith = this.playwith;
        switch(playwith)
        {
            case "playartist":
                labelType = "artistName";
                break;
            case "playtitle":
                labelType = "trackName";
                break;
        }

        choice.setAttribute("label", track.getProperty(SBProperties[labelType]));
        choice.setAttribute("url", track.getProperty(SBProperties.contentURL));
        buttons.push(choice);
    }
    //

    var rb = Math.round(Math.random() * (this.choices - 1));
    this.trackSamplePlayback("play", buttons[rb].getAttribute("url"));
    this.rounds--;
  },

  showFinalScore: function()
  {
    alert(this._strings.getString("end") + " " + (this.score).toString() + " " +
          this._strings.getString("points") + ".");
  },

  showInsufficientMediaWarning: function()
  {
    alert(this._strings.getString("warning") + ".");
  },

  startOrStop: function(e)
  {
    if ((e.target).getAttribute("id") == "stop")
        this.rounds = 0;

    this.setButtons();
  },

  trackSamplePlayback: function(command, url)
  {
    if ("sbIMediacoreManager" in Components.interfaces)
    {
        // new Media Core API (>= 0.8.0pre)
        switch (command)
        {
            case "play":
                var uri = gIOS.newURI(url, null, null);
                gMM.sequencer.playURL(uri);
                // gMM.playbackControl.position = this.startPosition;
                break;
            case "stop":
                gMM.playbackControl.stop();
                break;
            default:
                break;
        }
    }
    else
    {
        // old PlaylistPlaybackService API
        switch (command)
        {
            case "play":
                gPPS.playURL(url);
                break;
            case "stop":
                gPPS.stop();
                break;
            default:
                break;
        }
    }
  }

} // End window.mediaPage
