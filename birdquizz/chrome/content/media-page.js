// Shorthand
if (typeof(Cc) == "undefined")
  var Cc = Components.classes;
if (typeof(Ci) == "undefined")
  var Ci = Components.interfaces;
if (typeof(Cu) == "undefined")
  var Cu = Components.utils;
if (typeof(Cr) == "undefined")
  var Cr = Components.results;

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
    if (!this._mediaListView) {
      this._mediaListView = value;
    } else {
      throw new Error("mediaListView may only be set once.  Please reload the page");
    }
  },

  set startPosition(value){ this._startPos = value; },

  get choices() { return this._choices; },

  get rounds() { return this._rounds; },

  get score() { return this._score; },

  set choices(value) { this._choices = value; },

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

    if (!this._mediaListView) {
      Components.utils.reportError("Media Page did not receive  " + 
                                   "a mediaListView before the onload event!");
      return;
    } 

    this._playlist = document.getElementById("playlist");

    this.choices = 5;
    this.rounds = 3;

    this.score = 0;

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
    if (this._playlist) {
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
  
  showFinalScore: function()
  {
    alert("Game finished! Your final score was " + (this.score).toString() + " points.");
  },

  createButtons: function()
  {
    var mediaList = this._mediaListView.mediaList;
    var choice, item, r;
    var ml = new Array();
    var aChoice = document.getElementById("aChoice");

    for (var i = 1; i < mediaList.length; i++)
    {
        ml.push(mediaList.getItemByIndex(i));
    }

    for (var i = 0; i < this.choices; i++)
    {
        choice = document.createElement("button");
        r = parseInt(Math.random() * (ml.length - 1));
        item = ml[r];
        ml.splice(r, 1);
        choice.setAttribute("id", "choice" + i.toString());
        choice.setAttribute("label", "");
        choice.setAttribute("onclick", "window.mediaPage.selectAnswer(event);");
        aChoice.appendChild(choice);
    }
  },

  setButtons: function()
  {
    var node = document.getElementById("choice0");
    if (!node)
    {
        this.createButtons();
        var start = document.getElementById("start");
        start.disabled = true;
    }

    if (this.rounds <= 0)
    {
        this.showFinalScore();
        this.rounds = 3;
        this.score = 0;
        var start = document.getElementById("start");
        start.disabled = false;
        this.deleteButtons();
        return;
    }

    // Make sure we have the JavasSript modules we're going to use
    if (!window.SBProperties)
      Cu.import("resource://app/jsmodules/sbProperties.jsm");
    if (!window.LibraryUtils)
      Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
    if (!window.kPlaylistCommands)
      Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");
    
    if (!this._mediaListView) {
      Components.utils.reportError("Media Page did not receive  " + 
                                   "a mediaListView before the onload event!");
      return;
    }

    var mediaList = this._mediaListView.mediaList;
    var choice, item, r;
    var buttons = new Array();
    var ml = new Array();

    for (var i = 1; i < mediaList.length; i++)
    {
        ml.push(mediaList.getItemByIndex(i));
    }

    // Set the buttons
    for (var i = 0; i < this.choices; i++)
    {
        choice = document.getElementById("choice" + i.toString());
        r = parseInt(Math.random() * (ml.length - 1));
        item = ml[r];
        ml.splice(r, 1);
        choice.setAttribute("label", item.getProperty(SBProperties.trackName));
        choice.setAttribute("url", item.getProperty(SBProperties.contentURL));
        buttons.push(choice);
    }
    //

    var rb = parseInt(Math.random() * (this.choices - 1));

    this.playTrackSample(buttons[rb].getAttribute("url"));

    this.rounds--;
  },

  deleteButtons: function()
  {
    var aChoice = document.getElementById("aChoice");
    while (aChoice.hasChildNodes)
        aChoice.removeChild(aChoice.firstChild);
  },

  playTrackSample: function(url)
  {
    var pPS = Cc["@songbirdnest.com/Songbird/PlaylistPlayback;1"]
                .getService(Ci.sbIPlaylistPlayback);
    pPS.playURL(url);
  },

  selectAnswer: function(e)
  {
    var answer = (e.target).getAttribute("url");
    var pPS = Cc["@songbirdnest.com/Songbird/PlaylistPlayback;1"]
                .getService(Ci.sbIPlaylistPlayback);
    var currentTrack = pPS.currentURL;
    var position = pPS.position;
    pPS.stop();
    // this.startPosition = start;
    if (answer == currentTrack)
    {
        var score = position ? parseInt(10000 / position) : 0;
        this.score += score;
        var scoreLabel = document.getElementById("score");
        scoreLabel.setAttribute("value", this.score);
    }
    
    this.setButtons();
  }

} // End window.mediaPage