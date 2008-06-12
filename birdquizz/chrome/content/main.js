
// Make a namespace.
if (typeof Birdquizz == 'undefined') {
  var Birdquizz = {};
}

/**
 * UI controller that is loaded into the main player window
 */
Birdquizz.Controller = {

  /**
   * Called when the window finishes loading
   */
  onLoad: function() {

    // initialization code
    this._initialized = true;
    this._strings = document.getElementById("birdquizz-strings");
    
    // Perform extra actions the first time the extension is run
    if (Application.prefs.get("extensions.birdquizz.firstrun").value) {
      Application.prefs.setValue("extensions.birdquizz.firstrun", false);
      this._firstRunSetup();
    }
    

  },
  

  /**
   * Called when the window is about to close
   */
  onUnLoad: function() {
    this._initialized = false;
  },
  

  
  /**
   * Perform extra setup the first time the extension is run
   */
  _firstRunSetup : function() {
  
    // Call this.doHelloWorld() after a 3 second timeout
    // setTimeout(function(controller) { controller.doHelloWorld(); }, 3000, this); 
  

  },
  
  

  
};

window.addEventListener("load", function(e) { Birdquizz.Controller.onLoad(e); }, false);
