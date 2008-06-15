const choices	    = "extensions.birdquizz.choices";
const maxRounds	  = "extensions.birdquizz.maxRounds";
const playwith	  = "extensions.birdquizz.playwith";

var birdquizzPrefsPane = {
	openPreferences: function() {
        var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].
                            getService(Ci.nsIWindowMediator);
        var window = windowMediator.getMostRecentWindow("Songbird:Main");

        window.SBOpenPreferences("paneBQ");
	},

	handleLoad: function() {
	}
}
