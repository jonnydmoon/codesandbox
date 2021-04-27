
let lib = {};

lib.wait = async function(ms = 1000) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

//lib.sendText(myInput, 'moon')
lib.sendText = async function(el, value) {
	el.value = value;
	el.dispatchEvent(new Event('input'));
	return el;
}

lib.retry = async function(fn, timeout = 4000){
	return new Promise((resolve, reject) => {
		 let timeoutRef = setTimeout(() => {
			 clearInterval(intervalRef);
			 reject(new Error(`Could not execute fn ${fn}`))}, timeout);
		 let intervalRef = setInterval(()=>{
			 let result = fn();
			 if(result){
				clearInterval(intervalRef);
				clearTimeout(timeoutRef);
				resolve(result);
			 }
		 }, 100)
	});
}

lib.wrapWithRetry = function(fn, errorFn){
	return async function(...args){
		let timeout = args.pop();
		try {
			return await lib.retry(() => fn(...args), timeout);
		} catch (e){
			if(errorFn) {
				errorFn(...args, timeout, e);
			} else{
				throw new Error(`My Error: Could not execute function ${fn.name} with args ...`);
			}
		}
	}
}

// await lib.waitForQuery(document, '#find-individual', 1000);
lib.waitForQuery = lib.wrapWithRetry((node, selector) => node.querySelector(selector), (...args) => {
	let node = args[0];
	let selector = args[1];
	if(node.body){node = node.body;}
	throw new Error(`My Error: Could not find selector ${selector} on ${node.tagName}#${node.id}.${node.classList.toString().split(' ').join('.')}`);
});


lib.findNodeWithText = function(searchNode, selector, text){
	 return [...searchNode.querySelectorAll(selector)].filter(node => node.textContent.includes(text)).pop();
}

// await lib.waitForNodeWithText(document, 'td', 'moon', 2000);
lib.waitForNodeWithText = lib.wrapWithRetry(lib.findNodeWithText);


// ref: http://stackoverflow.com/a/1293163/2343
//lib.CSVToArray("Dads,Moms,Kids\nJonny,Shelly,Caroline\nJesse,Tara,Bella")
lib.CSVToArray = function( strData, strDelimiter ){
	strDelimiter = (strDelimiter || ",");
	var objPattern = new RegExp(("(\\" + strDelimiter + "|\\r?\\n|\\r|^)" + "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" + "([^\"\\" + strDelimiter + "\\r\\n]*))"), "gi");
	var arrData = [[]];
	var arrMatches = null;
	while (arrMatches = objPattern.exec( strData )){
		var strMatchedDelimiter = arrMatches[ 1 ];
		if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter ){ arrData.push( [] ); }
		var strMatchedValue;
		if (arrMatches[ 2 ]){ strMatchedValue = arrMatches[ 2 ].replace(new RegExp( "\"\"", "g" ), "\"" ); }
		else { strMatchedValue = arrMatches[ 3 ]; }
		arrData[ arrData.length - 1 ].push( strMatchedValue );
	}
	return( arrData );
}

lib.CSVToObjects = function(csv) {
	let [headerRow, ...rows] = csv;
	return rows.map(row => lib.zipObject(headerRow, row));
}

// lib.zipObject(musicRows[0], musicRow);
lib.zipObject = function(keys, values) {
	let result = {};
	keys.forEach((key, i) => result[key] = values[i]);
	return result;
}

lib.waitForAndSendText = async function(node, selector, value, timeout = 4000){
	let input = await lib.waitForQuery(node, selector, timeout);
	lib.sendText(input, value);
	return input;
}


lib.run = async function(){
	const wardList = lib.getWardList();
	lib.__wardList = wardList;
	const recordsToProcess = wardList.filter(member => !member.done);
	console.log(`There are ${recordsToProcess.length} records to process.`);
	if(recordsToProcess.length === 0){
		console.log('FINISHED! There are no more records to process');
		return;
	}
	await lib.updateRecord(recordsToProcess[0]);
}

/*
Dads,Moms,Kids
Jonny,Shelly,Caroline
Jesse,Tara,Bella
*/
lib.getWardList = function(){
	let wardList = localStorage.__wardList && JSON.parse(localStorage.__wardList);
	if (!wardList){
		let csvStr = prompt('Please paste the csv of the ward list.');
		let csv = lib.CSVToArray(csvStr);
		let csvObjects = lib.CSVToObjects(csv);
		wardList = csvObjects;
		lib.__wardList = wardList;
		lib.saveWardList();
	}
	return wardList;
};

lib.saveWardList = function(){
	localStorage.__wardList = JSON.stringify(lib.__wardList);
}

lib.updateRecord = async function(member){
	await lib.waitForAndSendText(document, '#lookup-name', `${member.lastName}, ${member.firstName}`);
	await lib.waitForAndSendText(document, '#birth-date', member.birthDateFormatted);

	member.done = true;
	lib.saveWardList();
	console.log(`Finished importing: ${member.firstName} ${member.lastName}`);
}

/*
  var myWindow = window.open("", "myWindow", "width=200,height=100");
  myWindow.document.write("<p>This is 'myWindow'</p>");

  // You can have the window control the frame
opener.document.body
opener.alert
opener.location.href = 'https://google.com'
"https://google.com"
opener.location.href = 'https://stackoverflow.com/questions/1293147/example-javascript-code-to-parse-csv-data'

You just can't modify if the domain is different, but you can still navigate.

  */

