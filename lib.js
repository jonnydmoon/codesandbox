window.lib = window.lib || {};

lib.wait = async function (ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

//lib.sendText(myInput, 'moon')
lib.sendText = async function (el, value) {
  el.value = value;
  el.dispatchEvent(new Event("input"));
  return el;
};

lib.retry = async function (fn, timeout = 4000) {
  return new Promise((resolve, reject) => {
    let timeoutRef = setTimeout(() => {
      clearInterval(intervalRef);
      reject(new Error(`Could not execute fn ${fn}`));
    }, timeout);
    let intervalRef = setInterval(() => {
      let result = fn();
      if (result) {
        clearInterval(intervalRef);
        clearTimeout(timeoutRef);
        resolve(result);
      }
    }, 100);
  });
};

lib.wrapWithRetry = function (fn, errorFn) {
  return async function (...args) {
    let timeout = args.pop();
    try {
      return await lib.retry(() => fn(...args), timeout);
    } catch (e) {
      if (errorFn) {
        errorFn(...args, timeout, e);
      } else {
        throw new Error(
          `My Error: Could not execute function ${fn.name} with args ...`
        );
      }
    }
  };
};

// await lib.waitForQuery(document, '#find-individual', 1000);
lib.waitForQuery = lib.wrapWithRetry(
  (node, selector) => node.querySelector(selector),
  (...args) => {
    let node = args[0];
    let selector = args[1];
    if (node.body) {
      node = node.body;
    }
    throw new Error(
      `My Error: Could not find selector ${selector} on ${node.tagName}#${
        node.id
      }.${node.classList.toString().split(" ").join(".")}`
    );
  }
);

lib.findNodeWithText = function (searchNode, selector, text) {
  return [...searchNode.querySelectorAll(selector)]
    .filter((node) => node.textContent.includes(text))
    .pop();
};

lib.findNodesWithText = function (searchNode, selector, text) {
  return [...searchNode.querySelectorAll(selector)].filter((node) =>
    node.textContent.includes(text)
  );
};

// await lib.waitForNodeWithText(document, 'td', 'moon', 2000);
lib.waitForNodeWithText = lib.wrapWithRetry(lib.findNodeWithText);

// ref: http://stackoverflow.com/a/1293163/2343
//lib.CSVToArray("Dads,Moms,Kids\nJonny,Shelly,Caroline\nJesse,Tara,Bella")
lib.CSVToArray = function (strData, strDelimiter) {
  strDelimiter = strDelimiter || ",";
  var objPattern = new RegExp(
    "(\\" +
      strDelimiter +
      "|\\r?\\n|\\r|^)" +
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      '([^"\\' +
      strDelimiter +
      "\\r\\n]*))",
    "gi"
  );
  var arrData = [[]];
  var arrMatches = null;
  while ((arrMatches = objPattern.exec(strData))) {
    var strMatchedDelimiter = arrMatches[1];
    if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
      arrData.push([]);
    }
    var strMatchedValue;
    if (arrMatches[2]) {
      strMatchedValue = arrMatches[2].replace(new RegExp('""', "g"), '"');
    } else {
      strMatchedValue = arrMatches[3];
    }
    arrData[arrData.length - 1].push(strMatchedValue);
  }
  return arrData;
};

lib.CSVToObjects = function (csv) {
  let [headerRow, ...rows] = csv;
  return rows.map((row) => lib.zipObject(headerRow, row));
};

// lib.zipObject(musicRows[0], musicRow);
lib.zipObject = function (keys, values) {
  let result = {};
  keys.forEach((key, i) => (result[key] = values[i]));
  return result;
};

lib.waitForAndSendText = async function (
  node,
  selector,
  value,
  timeout = 4000
) {
  let input = await lib.waitForQuery(node, selector, timeout);
  lib.sendText(input, value);
  return input;
};

lib.loadFile = function tempLoadFile(file, onLoad) {
  // This is only used for testing. go to php-index for source of truth.
  const css = file.endsWith("css");
  const node = document.createElement(css ? "link" : "script");
  if (css) {
    node.rel = "stylesheet";
    node.href = file;
  } else {
    node.type = "text/javascript";
    node.src = file;
    node.async = false; // loads in parallel & keeps the execution order of the scripts.
    if (onLoad) {
      node.onload = onLoad;
    }
  }
  document.head.appendChild(node);
};

lib.run = async function () {
  const wardList = lib.getWardList();
  lib.__wardList = wardList;
  lib.renderUI();
};

/*
firstName,lastName,phone,address
Jonny,Anders,7773993932,123 N 456 W Orem UT
Shelly,Timmel,7773993932,222 N 333 W Orem UT
Caroline,Young,7773993932,222 N 333 W Orem UT
Ben,Knight,7773993932,222 N 333 W Orem UT
*/
lib.getWardList = function () {
  let wardList = localStorage.__wardList && JSON.parse(localStorage.__wardList);
  if (!wardList) {
    let csvStr = prompt("Please paste the csv of the ward list.");
    let csv = lib.CSVToArray(csvStr);
    let csvObjects = lib.CSVToObjects(csv);
    wardList = csvObjects;

    lib.__wardList = wardList;
    lib.saveWardList();
  }

  wardList.forEach((item, i) => {
    item.id = i;
    lib.formatItemFromCsv(item);
  });
  return wardList;
};

lib.saveWardList = function () {
  localStorage.__wardList = JSON.stringify(lib.__wardList);
};

lib.markAsDone = function (isSuccess) {
  let item = lib.getCurrentRecord();
  item.done = true;
  if (!isSuccess) {
    item.skipped = true;
  }
  lib.saveWardList();
  lib.renderUI();
};

lib.resetItem = function (id) {
  let item = lib.getRecordById(id);
  delete item.done;
  delete item.skipped;
  lib.saveWardList();
  lib.renderUI();
};

lib.updateRecord = async function () {
  let member = lib.getCurrentRecord();
  //await lib.waitForAndSendText(document, '#lookup-name', `${member.lastName}, ${member.firstName}`);
  //await lib.waitForAndSendText(document, '#birth-date', member.birthDateFormatted);

  await lib.waitForAndSendText(
    opener.document,
    "input",
    `${member.lastName}, ${member.firstName}`
  );

  let button = await lib.retry(
    () => opener.document.querySelectorAll("button[type=submit]")[0]
  );
  button.click();

  member.done = true;
  lib.saveWardList();
  console.log(`Finished importing: ${member.firstName} ${member.lastName}`);
  lib.renderUI();
};

lib.getCurrentRecord = function () {
  return lib.__wardList.find((item) => !item.done);
};

lib.getRecordById = function (id) {
  return lib.__wardList.find((item) => item.id === id);
};

lib.renderUI = function () {
  let items = lib.__wardList;
  const finishedItems = items.filter((item) => item.done);
  const doneItems = items.filter((item) => item.done && !item.skipped);
  const skippedItems = items.filter((item) => item.skipped);
  const pendingItems = items.filter((item) => !item.done);
  const pendingRecord = lib.getCurrentRecord() || {};
  const finished = finishedItems.length === items.length;

  function getLabel(item) {
    if (item.skipped) {
      return "skipped";
    }
    if (item.done) {
      return "success";
    }
    return "pending";
  }

  function renderItems(items) {
    return items
      .map(
        (item) => `
		<div>
			${item.firstName} ${item.lastName}:  ${getLabel(item)}
			<a href="#a" onclick="lib.resetItem(${item.id}); return false;">(reset)</a>
		</div>
	`
      )
      .join("\n");
  }

  document.body.innerHTML = `
		<div>
      ${
        window.pendingPromise &&
        `<div>
        Waiting for User To Do Something:<br /><br />
        <a href="#a" onclick="window.pendingPromise.resolve(); return false;">Continue</a></div><br />
        <a href="#a" onclick="window.pendingPromise.reject();  return false;">Cancel</a></div><br /><br />
      `
      }
      Records Finished: ${finishedItems.length} of ${items.length}<br />
			<br />
			${
        finished
          ? "<br />All Done!<br /><br />"
          : `
				Current Record To Import: ${pendingRecord.firstName} ${pendingRecord.lastName}<br />
				<a href="#a" onclick="lib.updateRecord2(); return false;">Import Current Record</a> <br />
				<a href="#a" onclick="lib.markAsDone(true); return false;">Mark Current Record as Done</a> <br />
        <a href="#a" onclick="lib.markAsDone(false); return false;">Mark Current Record as Skipped</a> <br />
        <a href="#a" onclick="lib.fillInAddress(); return false;">Autofill Address page with current record</a> <br />
			`
      }
			<br />
			<br />
			<a href="#a" onclick="localStorage.__wardList = ''; lib.run(); return false;">Clear CSV File</a> <br />
			<br />
			<br />

			<h4>Skipped Items</h4>
			${renderItems(skippedItems)}

			<h4>Finished Items</h4>
			${renderItems(doneItems)}

			<h4>Pending Items</h4>
			${renderItems(pendingItems)}

		</div>
	`;
};

lib.updateRecord2 = async function () {
  let member = lib.getCurrentRecord();

  //opener.location.href = "https://lcr.churchofjesuschrist.org/records/request/find-member";

  await lib.retry(
    () => lib.findNodeWithText(opener.document, "label", "Member Lookup"),
    5000
  );

  await lib.wait(1000);

  await lib.waitForAndSendText(
    opener.document,
    "#mrnOrName",
    member.fullNameReversed
  );
  await lib.waitForAndSendText(
    opener.document,
    "#birthDate",
    member.birthDateFormatted
  );
  (await lib.waitForQuery(opener.document, "button.lookup", 3000)).click();

  await lib.waitForNodeWithText(
    opener.document,
    "div",
    "Select members to move",
    2000
  );
  let houseHoldMembers = lib.findNodesWithText(
    opener.document,
    "td",
    member.firstName
  );

  if (houseHoldMembers.length !== 1) {
    //alert("Please select someone and then do something to continue");

    window.pendingPromise = {};

    try {
      await new Promise((resolve, reject) => {
        window.pendingPromise.resolve = resolve;
        window.pendingPromise.reject = reject;
        lib.renderUI();
      });
    } catch (e) {
      delete window.pendingPromise;
      throw e;
    }
    delete window.pendingPromise;

    // You could have a global switch and then do an await for it to be true, have button in ui to continue
  } else {
    let memberLabelNode = houseHoldMembers[0];
    memberLabelNode.closest("tr").querySelector("input[type=checkbox]").click();
  }

  (await lib.waitForQuery(opener.document, "button.continue", 3000)).click();

  await lib.fillInAddress();

  await lib.wait(500);

  let result = await lib.keepTrying(async () => {
    (await lib.waitForQuery(opener.document, "button.move", 3000)).click();

    await lib.waitForNodeWithText(
      opener.document,
      "div",
      "Suggested Address",
      32000
    );
  }, 6);

  if (!result) {
    member.skipped = true;
  } else {
    (await lib.waitForQuery(opener.document, "button.move", 3000)).click();

    await lib.waitForNodeWithText(
      opener.document,
      "div",
      "records were successfully",
      2000
    );

    member.done = true;
  }

  lib.saveWardList();
  console.log(`Finished importing: ${member.firstName} ${member.lastName}`);
  lib.renderUI();

  await lib.wait(500);

  opener.location.href =
    "https://lcr.churchofjesuschrist.org/records/request/find-member";

  await lib.wait(500);
  lib.updateRecord2();
};

lib.fillInAddress = async function () {
  let member = lib.getCurrentRecord();

  if (member.phone) {
    await lib.waitForAndSendText(opener.document, "#phone", member.phone);
  }

  if (member.email) {
    await lib.waitForAndSendText(opener.document, "#email", member.email);
  }
  await lib.waitForAndSendText(
    opener.document,
    'input[placeholder="Street 1"]',
    member.street
  );
  await lib.waitForAndSendText(
    opener.document,
    'input[placeholder="City"]',
    member.city
  );
  await lib.waitForAndSendText(
    opener.document,
    'input[placeholder="Postal Code"]',
    member.zip
  );
};

lib.formatItemFromCsv = function (item) {
  item.firstName = item["Rest Of Name"].split(" ")[0];
  item.lastName = item["Last Name"];
  item.fullName = `${item.firstName} ${item.lastName}`;
  item.fullNameReversed = `${item.lastName}, ${item.firstName}`;
  item.birthDateFormatted = lib.formatDate(item["Birth Date"]); // "11 May 2011"
  item.phone = item["Mail Phone"];
  item.email = item["Email"];
  item.street = item["Housing Address"];
  item.city = "Provo";
  item.zip = "84602";
};

lib.excelDateToJSDate = function (serial) {
  return new Date((serial - (25567 + 1)) * 86400 * 1000);
};

lib.keepTrying = async function (fn, attempts) {
  if (attempts <= 0) {
    return false;
  }
  try {
    await fn();
    return true;
  } catch (e) {
    attempts--;
    return lib.keepTrying(fn, attempts);
  }
};

lib.formatDate = function (excelDate) {
  let date;
  if (excelDate.includes("/")) {
    date = new Date(excelDate);
  } else {
    date = lib.excelDateToJSDate(excelDate);
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

lib.run();

/*
// You can have the window control the parent window using opener.
opener.document.body, opener.alert, opener.location.href = 'https://google.com'
You just can't modify if the domain is different, but you can still navigate.
//window.open("myWebSurfer").close();


myWindow = window.open("", "myWebSurfer", "width=500,height=500");
node = document.createElement('script');
node.type = 'text/javascript';
node.src = 'https://csb-n0bjo.netlify.app/lib.js?cacheBust=' + Date.now();
myWindow.document.head.appendChild(node);

*/
