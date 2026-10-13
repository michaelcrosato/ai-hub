importScripts('city-generator.js');
self.onmessage=e=>{const {id,config}=e.data;try{const city=new Meridian.City(config);self.postMessage({id,ok:true,summary:city.summary()});}catch(error){self.postMessage({id,ok:false,error:error.message});}};
