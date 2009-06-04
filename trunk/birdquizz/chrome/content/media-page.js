// Shorthand

if (typeof(Cc) == "undefined")  
  var Cc = Components.classes;  
if (typeof(Ci) == "undefined")  
  var Ci = Components.interfaces;  
if (typeof(Cu) == "undefined")  
  var Cu = Components.utils;  

if (!gIOS) {
    var gIOS = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
}

var gMM = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"].getService(Ci.sbIMediacoreManager);

// Make sure we have the JavaScript modules we're going to use
if (!window.SBProperties) {
    Cu.import("resource://app/jsmodules/sbProperties.jsm");
}
if (!window.LibraryUtils) {
    Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
}
if (!window.kPlaylistCommands) {
    Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");
}


window.mediaPage = {

  // The sbIMediaListView that this page is to display
  _mediaListView: null,
  
  recursionLimit: 5,
  
  inhibitRandom: {},
  
  //"the game is on" flag
  playing: false,
  playbackPhase: 0,
  roundsArray: null,
  playingRound: -1,

  /**
   * Gets the sbIMediaListView that this page is displaying
   */
  get mediaListView() {
    return this._mediaListView;
  },

  /**
   * Set the sbIMediaListView that this page is to display.
   * Called in the capturing phase of window load by the Songbird browser.
   * Note that to simplify page creation mediaListView may only be set once.
   */
  set mediaListView(value) {
    if (!this._mediaListView) {
        this._mediaListView = value;
    } else {
        throw new Error("mediaListView may only be set once. " +
                        "Please reload the page");
    }
  },

  /**
   * Called when the page finishes loading.
   * By this time window.mediaPage.mediaListView should have
   * been externally set.
   */
  onLoad: function(e)  {
    if (!this._mediaListView) {
        Cu.reportError("Media Page did not receive a mediaListView before " +
                       "the onload event!");
        return;
    }

    this._strings = document.getElementById("birdquizz-strings");
    if (!this._strings) {
        //no strings, wtf? Give an english message and exit
        alert("AAAAAA!!!! Unexpected error!!!!");
        return;
    }
    
    try {
        //setup the list manager
        this.listsHandler = new LazyList(this.mediaListView.mediaList);
    
	    //setup the score manager
	    this.score = new ScoreManager(document.getElementById("score-label"),document.getElementById("score"));
	    this.score.hide();
	   
	    //setup the answer buttons manager
	    this.buttons = new ButtonsManager(document.getElementById("choices-type"),document.getElementById("choices-group-box"),document.getElementById("choices-box"));
	    this.buttons.hide();
	    
	    //setup the answers manager
	    this.answerBoxes = new AnswersManager(document.getElementById("answers-group-box"),document.getElementById("answers-box"));
	    this.answerBoxes.hide();
	    
	    //setup the start stop button
	    this.mainButton = document.getElementById("startStop");
	    this.mainButton.setAttribute("label", this._strings.getString("start"));
	    
    } catch(e) {
        this.unexpected(e);
        return;
    }
    
    this.mainButton.setAttribute("hidden", false);
    
  },
  
  readPrefs: function() {
    // Preferences
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch2);

    this.choices = prefs.getCharPref("extensions.birdquizz.choices");
    this.choices = this.choices >= 2 ? this.choices : 2;
    
    this.maxRounds = prefs.getCharPref("extensions.birdquizz.maxRounds");
    this.maxRounds = this.maxRounds >= 1 ? this.maxRounds : 1;
    
    this.playwith = prefs.getCharPref("extensions.birdquizz.playwith");
    this.enablesound = prefs.getBoolPref("extensions.birdquizz.sound");
    
    this.randomMatchTypesList = [];
    for (var i in matchTypes) {
	    if (prefs.getBoolPref(matchTypes[i].randomConf)) {
	       this.randomMatchTypesList.push(matchTypes[i]);
	    }
	}
    if (this.randomMatchTypesList.length == 0) {
        this.randomMatchTypesList.push(matchTypes.title);
    }
    
  },
  
  /**
   * Called as the window is about to unload
   */
  onUnload: function(e) {
    this.endQuiz(true);
  },
  
  /**
   * Show/highlight the MediaItem at the given MediaListView index.
   * Called by the Find Current Track button.
   */
  highlightItem: function(aIndex) {
  },

  /**
   * Called when something is dragged over the tabbrowser tab for this window
   */
  canDrop: function(aEvent, aSession) {
    return false;
  },

  /**
   * Called when something is dropped on the tabbrowser tab for this window
   */
  onDrop: function(aEvent, aSession) {
    return false;
  },
  
  showPrefs: function() {
     var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Ci.nsIWindowMediator);
     var window = windowMediator.getMostRecentWindow("Songbird:Main");
     window.SBOpenPreferences("paneBQ");
  },
  
  startQuiz: function() {
    if (this.playing) {
        return;
    }

//var startTime = new Date().getTime();

    //read configuration
    this.readPrefs();
 
    //round 0
    this.playingRound = -1;

    //reset and show the score
    this.score.reset();
    this.score.show();

    //setup the rounds     
    var numTracks = this.mediaListView.length;
    this.roundsArray = [];
    
     //create maxRound Rounds objects and fill with choices choices :)
    for (var i = 0; i < this.maxRounds; i++) {
        
        //set type of round (e.g. artist, album..)  number of possibilities and correct answer
        var trackNum = randomIndex(numTracks);
        var thisRound = new Round(this.choices,this.playwith,this.mediaListView.getItemByIndex(trackNum),this.randomMatchTypesList);
        
        
        for (var x = 0; x < this.choices; x++) {
            //we must found a vaalue to give as a wrong choice
            var rec = 0;
            //round type
            var roundType = thisRound.type.property;
            //this flag will be true once such value is found
            var done = false;
            if (!this.listsHandler.hasCompleteList(roundType) && !this.inhibitRandom[roundType]) {
                //we don't have a list of eg artists so check some random tracks. On huge libraries this will
                //be the way choices are found
                do {
	                var track = this.mediaListView.getItemByIndex(randomIndex(numTracks));
	                done = thisRound.addValue(track.getProperty(roundType));
	            
	            } while(!done && ++rec <= this.recursionLimit);
                
                //after recursionLimit efforts we give up and try another way
            
            } //else we've already enumerated the property so directly use the list
            
            if (!done) {
                this.inhibitRandom[roundType] = true;
                //if checking random tracks we didn't find values to be used as wrong choices we try with a specialized list (eg: albums list)
                var valueList = this.listsHandler.getList(roundType); 
                if (valueList.length < this.choices) {
                    //there are not enough values to play a round of this type
                    this.cantPlay();
                    return;
                }
                
                //let's check random eg years
                rec = 0;
                do {
                    done = thisRound.addValue(valueList[randomIndex(valueList.length)]);
                } while(!done && ++rec <= this.recursionLimit);
                
                //after recursionLimit efforts we completely give up about random
                
                if (!done) {
                    //stil no value? pass all the values until a good one is found (or the list finishes)
                    for(var z=0; z<valueList.length && !done; z++) {
                        done = thisRound.addValue(valueList[z]);
                    }
              
                    if(!done) {
                        //can't happen
                        //ASSERT(false);
                        this.cantPlay();
                        return;
                    }
                
                }
                
            }
         
        }
        
        this.roundsArray.push(thisRound);
    }
    
    //configure buttons
    this.buttons.setNumButtons(this.choices);
    this.buttons.show();
    
    //configure answers
    this.answerBoxes.setNumAnswers(this.maxRounds);
    this.answerBoxes.reset();
    this.answerBoxes.show();
    
    this.mainButton.setAttribute("label", this._strings.getString("stop"));
    
    this.playing = true;


//alert(new Date().getTime() - startTime);
    
    this.next();
    
  },
  
  next: function() {
  
    //next round
    this.playingRound++;
    //this is the Round object for this round
    var thisRound = this.roundsArray[this.playingRound];
    //put the labels on the buttons
    this.buttons.bind(thisRound);
    
    //get the track to play
    var track = thisRound.getTrack();
    if (!track) {
        //where is the track? show the "not enough media" message
        //Should we use a different message? this should never happen unless there are no tracks on the 
        //library in which case we can't arrive here as we exit on the startQuiz method
        
        //is there the ASSERT statement in songbird's javaascript?
        //ASSERT(false); 
        this.cantPlay();
        return;
    }
    
    //listen to this!
    this.play(track,true);
    
    this.startTime = new Date().getTime();
    
  },
  
  selectAnswer: function(i) {
    //stop the time
    var spentTime = new Date().getTime() - this.startTime;
    
    //get the Round object and check if the answer is correct
    var thisRound = this.roundsArray[this.playingRound];
    var correct = thisRound.guess(i);
    
    //stop the track
    this.stop();

    //if the sound is enabled..
    if (this.enablesound) {
        // sound implementation
        var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound)
        var url = "chrome://birdquizz/content/";
        url += correct ? "correct.wav" : "bad.wav";
        var uri = gIOS.newURI(url, null, null)
                      .QueryInterface(Ci.nsIURL);
        sound.init();
        sound.play(uri);
    }
    
    //if the answer is correct calculate the score
    if (correct) {
        var score = ( - spentTime / 2000 ) + 10;
        score *= thisRound.type.coefficient;
        score *= ((new Number(thisRound.choices) + 5) /10);;
        
        score = score < 1 ? 1 : Math.round(score);
        
        this.score.addScore(score);
    }
    
    //show the answer
    this.answerBoxes.showAnswer(this.playingRound,thisRound.getTrack(),correct,thisRound.getLabel(i));
    
    //next round or end game
    if (this.playingRound >= this.maxRounds-1) {
        this.endQuiz(); 
    } else {
        this.next(); 
    }
  },

  endQuiz: function(noFinalScore) {
    if (!this.playing) {
        return;
    }
    this.playing = false;
    
    //show the  start button
    this.mainButton.setAttribute("label", this._strings.getString("start"));
    //hide the answrers buttons, show just the answers (maybe for wrong answers we can also show what was clicked?)
    this.buttons.hide();
    
    //stop the track
    this.stop();
    
    if (!noFinalScore) {
        //show the score!
        alert(this._strings.getString("end") + " " + this.score.score + " " + this._strings.getString("points") + ".");
        //TODO what about storing top scores? maybe in an old fashioned way with three letters names :D
    }
    
  },
  
  cantPlay: function() { 
    //show the error message
    alert(this._strings.getString("warning") + ".");
    //end quiz (without showing the final results)
    this.endQuiz(true);    
  },
  
  startOrStop: function(e) { 
    try {
	    if (this.playing) {
	       this.endQuiz();
	    } else {
	       this.startQuiz();
	    }
	} catch(e) {
	   this.unexpected(e);
	}
  },
  
  unexpected: function(e) {
    alert(this._strings.getString("unexpected") + ".\n" + e);  
  },

  play: function(track,randomStart) {
    if (!track) {
        //TODO error message?
        return;
    }
    this.playbackPhase++;
    var uri = gIOS.newURI(track.getProperty(SBProperties.contentURL), null, null);
    gMM.sequencer.playURL(uri);
    
   
    //this doesn't work if executed in this thread. Probably the sequencer executes his commands
    //in an asynchronous fashion but is unable to give a consistent interface (ie track is loaded but
    //duration is not yet set and I can't modify position)
    //TODO the question is, how could I know when the track is really loaded?
    //as per now I keep this trick, if the track is not yet loaded it will start from the beginning
    if (randomStart) {
        var phase = this.playbackPhase;
        var that = this;
	    setTimeout(function() {
	       if (that.playbackPhase != phase) {
	           return;
	       }
		   if (gMM.playbackControl.duration > 120000) {
		        // songs shorter than 2 minutes start from the beggining
		        //start at least after 1 minute and with at least another minute still to play
		        var randomPoss = gMM.playbackControl.duration - 120000;
		        gMM.playbackControl.position = Math.round(Math.random() * randomPoss) + 60000;
		   }
		 },1);
     }
  },
  
  stop: function() {
    gMM.sequencer.stop();
  }
  
};

    
function Round(choices, playWith, track, randomList) {
    if(!choices || !playWith || !track) {
        throw new Error("Can't initialize Round");
    }
 
    this.type = matchTypes[playWith] ? matchTypes[playWith] : randomList[randomIndex(randomList.length)];
    this.answers = [];
    this.hash = {};
    this.choices = choices;
    
    this.fillIndex = 0;
    
    this.answerNumber = randomIndex(choices);
    this.correctTrack = track;
    var neededValue = cleanValue(track.getProperty(this.type.property));
    this.hash[neededValue] = true;
    this.answers[this.answerNumber] = neededValue;
}

Round.prototype = {
    
   addValue: function(value) {
        if(this.fillIndex >= this.choices) {
            //too much tracks, return true as a signal that everything is ok as the list is full
            return true;
        }
        if(this.fillIndex == this.answerNumber) {
            this.fillIndex++;
        }
        
        var neededValue = cleanValue(value);
        if (!neededValue || this.hash[neededValue]) {
            return false;
        }
        
        this.answers[this.fillIndex] = neededValue;
        this.hash[neededValue] = true;
        
        this.fillIndex++;
        
        return true;
   },
    
    getLabel: function(index) {
        if (index >= this.answers.length) {
            return "";
        }
        return this.answers[index];
    },
    
    guess: function(value) {
        if (value == this.answerNumber) {
            return true;
        } else {
            return false;   
        }
    },
    
    getTrack: function() {
        if (this.correctTrack) {
            return this.correctTrack;
        } 
        return null;
    },
    
    
};

function AnswersManager(container,answersContainer) {
    if (!container || !answersContainer) {
        throw new Error("Can't initialize AnswersManager");
    }
    
    this.answerLabels = [];
    
    this.container = container;
    this.answersContainer = answersContainer;
}

AnswersManager.prototype = {
    
    setNumAnswers: function(newVal) {
        var now =  this.answerLabels.length;
        
        if (now < newVal) {
        
            for (var i = now; i < newVal; i++) {
                var answerObj = {};
                
                var answerhBox = document.createElement("hbox");
                answerhBox.className = "answerhBox";
                answerhBox.setAttribute("hidden",true);
           
                answerObj.box = answerhBox;
           
                for (var j = 0; j < matchTypesList.length; j++) {
                  var label = document.createElement("label");
                  label.className = matchTypesList[j].labelType;
                  
                  answerObj[matchTypesList[j].id] = label;
                  answerhBox.appendChild(label);
                }
                
                var answerImg = document.createElement("image");
                answerImg.className = "answerImg";
                answerImg.setAttribute("src","");
                answerObj.image = answerImg;
                answerhBox.appendChild(answerImg);
                
                var response = document.createElement("label");
                response.className = "response";
                answerObj.response = response;
                answerhBox.appendChild(response);
                
                this.answerLabels.push(answerObj);
                this.answersContainer.appendChild(answerhBox);
            }
            
        } else if (now > newVal) {
            
            for (var i = now-1; i >= newVal; i--) {
                var toRem = this.answerLabels.pop();
                this.answersContainer.removeChild(toRem.box);
            }
        }
    },
    
    reset: function() {
        for (var i = 0; i < this.answerLabels.length; i++) {
            this.answerLabels[i].box.setAttribute("hidden",true);
        }
        this.next = 0;
    },
    
    showAnswer: function(roundNum,track,correct,response) {
        var labelId = this.answerLabels.length - (roundNum+1);
        var answerObj = this.answerLabels[labelId];
        
        var urlImg = "chrome://birdquizz/skin/";
        urlImg += correct ? "OK_Icons.png" : "not_OK_Icons.png";
        answerObj.image.setAttribute("src",urlImg);
        
        var responseText = correct ? "" : mediaPage._strings.getString("yousaid") + " " + response;
        answerObj.response.setAttribute("value",responseText);
        
        for (var i = 0; i < matchTypesList.length; i++) {
            answerObj[matchTypesList[i].id].setAttribute("value",track.getProperty(matchTypesList[i].property));
        }
        
        answerObj.box.addEventListener("click", function() {
            if(!window.mediaPage.playing) {
                window.mediaPage.play(track);
            }
        },false);
        
        answerObj.box.setAttribute("hidden",false);
    },
    
    show: function() {
        this.container.setAttribute("hidden",false);
        this.answersContainer.setAttribute("hidden",false);
    },
    
    hide: function() {
        this.container.setAttribute("hidden",true);
        this.answersContainer.setAttribute("hidden",true);
    }
};

function ButtonsManager(label,container,buttonsContainer) {
    if (!container || !buttonsContainer || !label) {
        throw new Error("Can't initialize ButtonsManager");
    }
    this.label = label;
    this.answerButtons = [];
    
    this.container = container;
    this.buttonsContainer = buttonsContainer;
    
}

ButtonsManager.prototype = {

    setNumButtons: function(newVal) {
        var now =  this.answerButtons.length;
        
        if (now < newVal) {
        
            for (var i = now; i < newVal; i++) {
                var choice = document.createElement("button");
                
                choice.addEventListener("click",this.getClickClosure(i),false);
                
                this.answerButtons.push(choice);
                this.buttonsContainer.appendChild(choice);
            }
            
            
        } else if (now > newVal) {
            
            for (var i = now-1; i >= newVal; i--) {
                var toRem = this.answerButtons.pop();
                this.buttonsContainer.removeChild(toRem);
            }
        }
    },
    
    getClickClosure: function(i) {
        return function() {
            mediaPage.selectAnswer(i);
        };
    },
    
    bind: function(thisRound) {
        this.label.value = mediaPage._strings.getString("pick") + " " + mediaPage._strings.getString(thisRound.type.id);

        //setup buttons for this round
        for (var i = 0; i < this.answerButtons.length; i++) {
            var choice = this.answerButtons[i];
            choice.setAttribute("label",thisRound.getLabel(i));
        }
    },
    
    hide: function() {
        this.container.setAttribute("hidden",true);
        this.buttonsContainer.setAttribute("hidden",true);
    },
    
    show: function() {
        this.container.setAttribute("hidden",false);
        this.buttonsContainer.setAttribute("hidden",false);
    }
};


function ScoreManager(scoreLabel,scoreContainer) {
    if (!scoreLabel || !scoreContainer) {
        throw new Error("Can't initialize ScoreManager");
    }
    this.score = 0;
    this.scoreLabel = scoreLabel;
    this.scoreContainer = scoreContainer;
}

ScoreManager.prototype = {
    addScore: function(newScore) {
        this.score += newScore;
        this.showNewScore();
        
    },
    
    showNewScore: function() {
        this.scoreContainer.value = this.score;
    },
    
    show: function() {
        this.scoreLabel.setAttribute("hidden",false);
        this.scoreContainer.setAttribute("hidden",false);
    },
    
    hide: function() {
        this.scoreLabel.setAttribute("hidden",true);
        this.scoreContainer.setAttribute("hidden",true);
    },
        
    reset: function() {
        this.score = 0;
        this.showNewScore();
    },
    
};

function LazyList(mediaList) {
    if (!mediaList) {
        throw new Error("Can't initialize LazyList.");
    }
    this.listGenerators = {};
    this.lists = {};
    this.times = {};
    this.mediaList = mediaList;
}

LazyList.prototype = {
    getList: function(prop) {
	    if(!this.listGenerators[prop]) {
	        if (this.listGenerators[prop] === false) {
	            return this.lists[prop];
	        } else {        
	            this.listGenerators[prop] = this.mediaList.getDistinctValuesForProperty(prop);
	            this.lists[prop] = [];
	        }
	    }
	  
	    var thisCall = new Date().getTime();
	    if (this.times[prop] && thisCall - this.times[prop] < 2000) {
	        return this.lists[prop];
	    }
	    this.times[prop] = thisCall;
	    
	    
	    var c = 0;
	    while(this.listGenerators[prop].hasMore() && c < 500) {
	        var val = cleanValue(this.listGenerators[prop].getNext());
	        if (val) {
	            c++;
	            this.lists[prop].push(val);
	        }
	        
	    }
	    
	    if (!this.listGenerators[prop].hasMore()) {
	        this.listGenerators[prop] = false;
	    }
	    
	     return this.lists[prop];
    
    },
    
    hasCompleteList: function(prop) {
        if (this.listGenerators[prop] === false) {
            return true;
        }
    }
};

//some utils
function randomIndex(length) {
    return trackNum = Math.round(Math.random() * (length-1));
}

function cleanValue(value) {
    if(!value) {
        return "";
    }
    return value.toLowerCase().replace(/^\s*([\s\S]*?)\s*$/,"$1");
}


//don't touch the below code unless you've checked all the dependencies
var matchTypes = {
  artist: {
    labelType: "artistName", 
    property: SBProperties.artistName,
    randomConf: "extensions.birdquizz.random_artist",
    coefficient: 0.8
  },
  title: {
    labelType: "trackName",
    property: SBProperties.trackName,
    randomConf: "extensions.birdquizz.random_title",
    coefficient: 1.1
  },
  album: {
    labelType: "albumName",
    property: SBProperties.albumName,
    randomConf: "extensions.birdquizz.random_album",
    coefficient: 1
  },
  year: {
    labelType: "yearName",
    property: SBProperties.year,
    randomConf: "extensions.birdquizz.random_year",
    coefficient: 1.5
  }
};

for (var i in matchTypes) {
    matchTypes[i].id = i;
}

var matchTypesList = [
    matchTypes["year"],
    matchTypes["artist"],
    matchTypes["album"],
    matchTypes["title"]
];