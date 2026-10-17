// Expansion proof: new mission data using existing interact / vehicle / reach / deliver goals.
(() => { Drive.registerMission({schema:1,id:'spare',name:'THE SPARE KEY',reward:650,start:{x:420,y:720},choiceTitle:'Which vehicle do we recover?',choiceText:'The compact is quick. The van can take a hit.',choices:[{id:'compact',label:'Recover the Cricket compact',vehicle:'compact'},{id:'van',label:'Recover the Box Office van',vehicle:'van'}],stages:[
 {id:'brief',kind:'interact',target:'brief',title:'Take the garage recovery job',line:'MARA: Our spare van is on a private tow list. Let us change that.'},
 {id:'wheels',kind:'vehicle',target:'valet',title:'Find a replacement vehicle'},
 {id:'key',kind:'interact',target:'tow',title:'Recover the key from Tow & Go',save:true,line:'KIT: They put a parking boot on their own tow truck.'},
 {id:'return',kind:'deliver',target:'shop',title:'Return the key to Marigold Garage'}
]}); })();
