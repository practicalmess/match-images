import { GoogleSpreadsheet } from "google-spreadsheet";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import http from "http";
import url from "url";
import opn from "opn";
import cron from "node-cron";
import * as fs from "fs";

// Define the function to be executed periodically

const keys = {
  installed: {
    client_id:
      "367089248760-pcjn62nks54jo5lfb7a5mi1084eb6c6b.apps.googleusercontent.com",
    project_id: "the-last-poster-show",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: "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",
    redirect_uris: ["http://localhost:3000/oauth2callback"],
  },
};

/**
 * Create a new OAuth2Client, and go through the OAuth2 content
 * workflow.  Return the full client to the callback.
 */
function getAuthenticatedClient() {
  return new Promise((resolve, reject) => {
    // create an oAuth client to authorize the API call.  Secrets are kept in a `keys.json` file,
    // which should be downloaded from the Google Developers Console.
    const oAuth2Client = new OAuth2Client(
      keys.installed.client_id,
      keys.installed.client_secret,
      keys.installed.redirect_uris[0]
    );

    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: "https://www.googleapis.com/auth/spreadsheets",
    });

    // Open an http server to accept the oauth callback. In this simple example, the
    // only request to our webserver is to /oauth2callback?code=<code>
    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url.indexOf("/oauth2callback") > -1) {
            console.log("Server received a request");
            // acquire the code from the querystring, and close the web server.
            const qs = new url.URL(req.url, "http://localhost:3000")
              .searchParams;
            const code = qs.get("code");
            console.log(`Code is ${code}`);
            res.end("Authentication successful! Please return to the console.");
            // server.destroy();

            // Now that we have the code, use that to acquire tokens.
            const r = await oAuth2Client.getToken(code);
            // Make sure to set the credentials on the OAuth2 client.
            oAuth2Client.setCredentials(r.tokens);
            console.info("Tokens acquired.");
            resolve(oAuth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        // open the browser to the authorize url to start the workflow
        opn(authorizeUrl, { wait: false }).then((cp) => cp.unref());
      });
    // destroyer(server);
  });
}

const baseUrl = "https://the-last-poster-show.nyc3.digitaloceanspaces.com";
const bucketName = "the-last-poster-show";
const maxKeys = 600; // Set a value for MaxKeys as per your requirement
const delimiter = ",";

const oAuth2Client = await getAuthenticatedClient();
const batchingSpreadsheet = new GoogleSpreadsheet(
  "1wTQDa6t-SLnabgVgcc1dVHWIdPVsO1vypsni_44wyME",
  oAuth2Client
);
await batchingSpreadsheet.loadInfo();
const fullInvSpreadsheet = new GoogleSpreadsheet(
  "1xqEAFXMvqQghKSVj8xtijrhc-MK6Qx1vvik_1H6ZhNE",
  oAuth2Client
);
const matchSheet = batchingSpreadsheet.sheetsByTitle["matches"];
await fullInvSpreadsheet.loadInfo();
const fullInvSheet = fullInvSpreadsheet.sheetsByTitle["Sheet1"];
const completeSheet = fullInvSpreadsheet.sheetsByTitle["CompleteListings"];

const tokenSheet = batchingSpreadsheet.sheetsByTitle["tokens"];

async function analyzeImage(imageUri) {
  var apiKey = "AIzaSyCYfg3iHMY90cdBElSNspscgJG0Wc09N2E";
  var apiUrl = "https://vision.googleapis.com/v1/images:annotate?key=" + apiKey;
  const imagePath = `https://the-last-poster-show.nyc3.cdn.digitaloceanspaces.com/${imageUri}`;
  var requestBody = {
    requests: [
      {
        image: {
          source: {
            imageUri: imagePath,
          },
        },
        features: [
          {
            type: "TEXT_DETECTION",
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(apiUrl, requestBody);
    var parsedResponse = response.data.responses[0];
    const textList = [];
    try {
      parsedResponse?.textAnnotations?.forEach((text, i) => {
        if (i > 0) {
          textList.push(text.description);
        }
      });
    } catch (err) {
      console.log(`Can't add text: ${err}`);
    }
    return textList;
  } catch (err) {
    console.log(err);
  }
}

async function createReferenceList(imagePaths = []) {
  if (imagePaths.length > 0) {
    try {
      // let referenceList = await Promise.all(
      imagePaths.map(async (path, i) => {
        try {
          if (path.length > 0) {
            const key = path.slice(21, -4);
            const sheet = batchingSpreadsheet.sheetsByTitle["ThumbLabels"];
            const rows = await sheet.getRows();
            const existingKeys = rows.map((row) => row.get("Key"));
            if (existingKeys.indexOf(key) === -1) {
              const labels = await analyzeImage(path);
              await new Promise((resolve) => setTimeout(resolve, 5000));
              console.log(`Adding ${key}`);
              // return [key, labels.join(", ")];
              sheet.addRow([key, labels.join(",")]);
            } else {
              console.log(`Already analyzed ${key}`);
            }
          } else {
            console.log(`No labels found`);
          }
        } catch (err) {
          console.log(err);
        }
      });
      // );
      // return referenceList;
    } catch (err) {
      console.log(err);
    }
  }
}

const batchSize = 10;

// async function analyzeThumbnailBatch(token) {
//   const thumbSheet = batchingSpreadsheet.sheetsByTitle["thumbs"];
//   const thumbRows = await thumbSheet.getRows();
//   await tokenSheet.loadCells();
//   if (thumbRows.length > token + batchSize) {
//     const thumbnailBatch = await thumbSheet.getRows({
//       offset: token,
//       limit: batchSize,
//     });
//     const smallImagePaths = thumbnailBatch.map((row) => row.get("path"));
//     await createReferenceList(smallImagePaths);
//     tokenSheet.getCell(1, 0).value = token + batchSize;
//     await tokenSheet.saveUpdatedCells();
//   } else {
//     const numRows = thumbRows.length - token + 1;
//     const thumbnailBatch = await thumbSheet.getRows(token, numRows);
//     const smallImagePaths = thumbnailBatch.map((row) => row.get("path"));
//     await createReferenceList(smallImagePaths);
//     tokenSheet.getCell(2, 1).value = 1;
//     await tokenSheet.saveUpdatedCells();
//   }
// }

// async function startNextThumbnailBatch() {
//   const tokenRows = await tokenSheet.getRows();
//   const token = Number(tokenRows[0].get("token1"));
//   try {
//     await analyzeThumbnailBatch(token);
//   } catch (err) {
//     await new Promise((resolve) => setTimeout(resolve, 5000));
//     try {
//       await startNextThumbnailBatch();
//     } catch {
//       await new Promise((resolve) => setTimeout(resolve, 10000));
//       try {
//         await startNextThumbnailBatch();
//       } catch {
//         console.log("Too many retries");
//         // return;
//       }
//     }
//   }
//   await startNextThumbnailBatch();
// }

// // await startNextThumbnailBatch();

// async function processThumbs() {
//   const tokenCell = batchingSpreadsheet.sheetsByTitle["tokens"].getRange(1, 1);
//   tokenCell.setValue(1);
//   startNextThumbnailBatch();
// }

// // let continuationToken;

// async function getBucketImageUris() {
//   const token = tokenCell.getValue();
//   try {
//     if (!token) {
//       // Only trigger next batch if there is a new token
//       // Fetch images for the first batch
//       // fetchFirstBatch();
//       return;
//     } else {
//       fetchNextBatch(token);
//     }
//   } catch (err) {
//     console.error(err);
//     return [];
//   }
// }

// async function fetchFirstBatch() {
//   try {
//     const url = `${baseUrl}?list-type=2&delimiter=${delimiter}&max-keys=${maxKeys}&continuation-token=''`;
//     const response = axios.get(url);

//     const newToken = handleResponse(response);
//     if (newToken) {
//       tokenCell.setValue(newToken);
//     }
//   } catch (err) {
//     console.error(`Error fetching objects: ${err}`);
//   }
// }

// async function fetchNextBatch(token) {
//   try {
//     const url = `${baseUrl}?list-type=2&delimiter=${delimiter}&max-keys=${maxKeys}&continuation-token=${token}`;
//     const response = axios.get(url);

//     const newToken = handleResponse(response);

//     tokenCell.setValue(newToken);
//   } catch (err) {
//     console.error(`Error fetching objects: ${err}`);
//   }
// }

async function handleResponse(response) {
  if (response.getResponseCode() === 200) {
    const xml = response.getContentText();
    const parser = XmlService.getNamespace(
      "http://s3.amazonaws.com/doc/2006-03-01/"
    );
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    const contents = root.getChildren("Contents", parser) || [];
    const pathList = contents.filter(
      (item) =>
        item.getChildText("Key", parser).slice(-4) === ".jpg" ||
        item.getChildText("Key", parser).slice(-4) === ".png"
    );
    const imageList = pathList.map((item) => item.getChildText("Key", parser));

    // Process the batch here (e.g., save to spreadsheet, perform analysis, etc.)
    processBatch(imageList);

    // Check if there are more batches to fetch
    const continuationToken =
      root.getChild("NextContinuationToken", parser)?.getText() || "";

    return continuationToken;
  } else {
    console.error(`Error fetching objects: ${response.getContentText()}`);
  }
}

async function processBatch(imageList) {
  const spreadsheetFullSize = batchingSpreadsheet.sheetsByTitle["full"];
  const spreadsheetThumbs = batchingSpreadsheet.sheetsByTitle["thumbs"];
  imageList.forEach((image) => {
    if (image.slice(-4) === ".jpg") {
      spreadsheetFullSize.appendRow([image]);
    } else if (image.slice(-4) === ".png") {
      spreadsheetThumbs.appendRow([image]);
    }
  });
}

const ignoreList = [
  "PRODUCED",
  "DIRECTED",
  "BY",
  "SCREENPLAY",
  "WARNER",
  "BROS",
  "FILM",
  "FROM",
  "MOVIE",
  "M",
  "G",
  "-",
  "...",
  "MOTION",
  "PICTURE",
  "A",
  "AN",
  "THE",
  "OF",
  "!",
  ",",
  ".",
  "?",
  " ",
  `"`,
];

const searchForMatchesByText = async (text, thumbnailBatch) => {
  const matchList = [];
  const tokenRows = await tokenSheet.getRows();
  let matchNum = tokenRows[0].get("token2");
  thumbnailBatch.forEach((thumbnail) => {
    let matches = [];
    const labels = thumbnail.get("Labels");
    const labelArray = labels?.split(",");
    const filteredThumbLabels = labelArray?.filter(
      (label) => ignoreList.indexOf(label.toUpperCase().trim()) === -1
    );
    const cleanFilteredThumbLabels = filteredThumbLabels?.map((text) =>
      text.toUpperCase().trim()
    );

    if (cleanFilteredThumbLabels?.length > 2) {
      cleanFilteredThumbLabels?.forEach((smallText, i) => {
        if (text.indexOf(smallText) > -1) {
          matches.push(smallText);
        }
      });
      const matchPercent =
        (matches.length / cleanFilteredThumbLabels.length) * 100;
      if (matchPercent > 85) {
        matchNum++;
        matchList.push({
          Key: thumbnail.get("Key"),
          MatchPercent: matchPercent,
        });
      }
    }
  });
  tokenRows[0].set("token2", matchNum);
  await tokenRows[0].save();
  return matchList;
};

const matchBatchSize = 1000;

async function buildKey(title, category) {
  const cleanTitle = title
    .toLowerCase()
    .split("")
    .filter((letter) => letter !== "#")
    .join("");
  const cleanCategory = category
    .toLowerCase()
    .split("")
    .filter((letter) => letter !== "#")
    .join("");
  const categoryKey = cleanCategory
    .split(" ")
    .filter((item) => item !== "lobby" && item !== "cards")
    .join("");
  const keySlugArray = cleanTitle.split(" ");
  keySlugArray.push(categoryKey);
  keySlugArray.push("style");
  const keySlug = keySlugArray.join("-");
  const fullInvRows = await fullInvSheet.getRows();
  const allKeys = fullInvRows.map((row) => row.get("Key"));
  let styleCount = 1;
  allKeys.forEach((key) => {
    if (key[0].slice(0, keySlug.length) === keySlug) {
      styleCount++;
    }
  });

  keySlugArray.push(new String(styleCount).toString());
  return keySlugArray.join("-");
}

async function checkMatchesAndReset() {
  const matchRows = await matchSheet.getRows();
  const tokenRows = await tokenSheet.getRows();
  const matches = Number(tokenRows[0].get("token2"));
  const imageTextSheet = batchingSpreadsheet.sheetsByTitle["full"];

  console.log(matches);
  const imageTextRows = await imageTextSheet.getRows();
  const fullRowToken = Number(tokenRows[0].get("token3"));
  const imagePath = imageTextRows[fullRowToken].get("path");

  if (matches === 1) {
    console.log("Now adding to sheet...");
    const matchKey = matchRows[0].get("Key");
    const allRows = await fullInvSheet.getRows();
    const allKeys = allRows.map((row) => row.get("Key"));
    const existingMatchRows = await completeSheet.getRows();
    const existingKeys = existingMatchRows.map((row) => row.get("Key"));
    if (allKeys.indexOf(matchKey) === -1) {
      console.log("not found in inv");
      await fullInvSheet.addRow({
        Key: matchKey,
        "Image URI": `=IMAGE("https://the-last-poster-show.nyc3.digitaloceanspaces.com/${imagePath}")`,
      });
    } else if (existingKeys.indexOf(matchKey) === -1) {
      console.log("Found info, adding new completed record");
      const recordRow = allKeys.indexOf(matchKey);
      const row = allRows[recordRow];
      const title = row.get("Title");
      const price = row.get("Price");
      const genre = row.get("Genre");
      const tags = row.get("Tags");
      const category = row.get("Category");
      // const fullKey = buildKey(title, category);

      const newRow = {
        Key: matchKey,
        Price: price,
        Title: title,
        Genre: genre,
        Tags: tags,
        Category: category,
        "Image URI": `=IMAGE("https://the-last-poster-show.nyc3.digitaloceanspaces.com/${imagePath}")`,
        // FullKey: fullKey,
      };
      console.log(newRow);
      await completeSheet.addRow(newRow);
      allRows[recordRow].set(
        "Image URI",
        `=IMAGE("https://the-last-poster-show.nyc3.digitaloceanspaces.com/${imagePath}")`
      );
      await allRows[recordRow].save();
    } else {
      console.log("Completed record already added ");
    }
  }

  const currentFullImageRow = Number(tokenRows[0].get("token3"));
  tokenRows[0].set("token3", currentFullImageRow + 1);
  tokenRows[0].set("token2", 0);
  tokenRows[0].set("token1", 0);
  await tokenRows[0].save();
  await matchSheet.clearRows();
  // await startSingleImageMatch();
}

// await checkMatchesAndReset();

async function searchForMatchesByThumbBatch() {
  const tokenRows = await tokenSheet.getRows();
  await tokenSheet.loadCells();
  let thumbRowToken = tokenRows[0].get("token1");
  if (thumbRowToken === "done") {
    return;
  } else {
    thumbRowToken = Number(thumbRowToken);
    console.log(`Batch starting at ${thumbRowToken}...`);
  }
  const fullRowToken = Number(tokenRows[0].get("token3"));
  const thumbLabelSheet = batchingSpreadsheet.sheetsByTitle["ThumbLabels"];
  const matchSheet = batchingSpreadsheet.sheetsByTitle["matches"];
  const thumbTokenCell = tokenSheet.getCell(1, 0);
  const thumbLabelRows = await thumbLabelSheet.getRows();
  let thumbTextBatch;
  const imageTextSheet = await batchingSpreadsheet.sheetsByTitle["full"];
  await imageTextSheet.loadCells();

  const imageTextRows = await imageTextSheet.getRows();
  const imageText = imageTextRows[fullRowToken]
    .get("labels")
    .split(",")
    .map((text) => text.toUpperCase().trim());
  if (thumbLabelRows.length > thumbRowToken + matchBatchSize) {
    thumbTextBatch = await thumbLabelSheet.getRows({
      offset: thumbRowToken - 1,
      limit: matchBatchSize,
    });
    thumbTokenCell.value = thumbRowToken + matchBatchSize;
    await tokenSheet.saveUpdatedCells();
    const newMatches = await searchForMatchesByText(imageText, thumbTextBatch);
    console.log(newMatches);
    await matchSheet.addRows(newMatches);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      await searchForMatchesByThumbBatch();
    } catch (err) {
      console.log(`Waiting 5 seconds and trying again - ${err}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        await searchForMatchesByThumbBatch();
      } catch (err) {
        console.log(`Waiting 10 seconds and trying again - ${err}`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        try {
          await searchForMatchesByThumbBatch();
        } catch (err) {
          console.log(`Waiting 15 seconds and trying again - ${err}`);
          await new Promise((resolve) => setTimeout(resolve, 15000));
          try {
            await searchForMatchesByThumbBatch();
          } catch {
            console.log(
              "Too many retries, aborting search and resetting full image token to try this image again"
            );
            return;
          }
        }
      }
    }
  } else {
    const numRows = thumbLabelRows.length - thumbRowToken + 1;
    thumbTextBatch = await thumbLabelSheet.getRows({
      offset: thumbRowToken - 1,
      limit: numRows,
    });
    thumbTokenCell.value = "done";
    tokenSheet.saveUpdatedCells();
    const newMatches = await searchForMatchesByText(imageText, thumbTextBatch);
    await matchSheet.addRows(newMatches);
    await checkMatchesAndReset();
  }
}

// await searchForMatchesByThumbBatch();

async function startSingleImageMatch() {
  const tokenRows = await tokenSheet.getRows();
  tokenRows[0].set("token1", 0);
  tokenRows[0].set("token2", 0);
  await matchSheet.clearRows();
  const fullRowToken = Number(tokenRows[0].get("token3"));
  const currentTime = new Date().toISOString();
  const logStream = fs.createWriteStream(
    `logs/cronlog-${fullRowToken}-${currentTime}.txt`,
    { flags: "a" }
  );
  process.stdout.write = logStream.write.bind(logStream);
  const fullImageRows = await batchingSpreadsheet.sheetsByTitle[
    "full"
  ].getRows();
  const imagePath = fullImageRows[fullRowToken].get("path");
  console.log(`Now matching ${imagePath}...`);
  const imageText = await analyzeImage(imagePath);
  fullImageRows[fullRowToken].set("labels", imageText.join(","));

  await tokenRows[0].save();
  await fullImageRows[fullRowToken].save();
  await searchForMatchesByThumbBatch();
}

async function myTask() {
  console.log("Matching started at:", new Date().toLocaleString());
  await startSingleImageMatch();
}

// Schedule the task to run every two minutes
cron.schedule("*/2 * * * *", async () => {
  try {
    await myTask();
  } catch (err) {
    console.log(err);
  }
});

async function checkForDuplicates() {
  const sheet = batchingSpreadsheet.sheetsByTitle["ThumbLabels"];
  var data = sheet.getDataRange().getValues();

  // Create an object to store unique values
  var uniqueValues = [];
  let removeCount = 0;
  // Loop through each row in the sheet
  for (var i = 0; i < data.length; i++) {
    var value = data[i][0];

    // Check if the value already exists in the uniqueValues object
    if (uniqueValues.indexOf(value) > -1) {
      // Duplicate found
      // removeCount++;
      console.log(value);

      sheet.deleteRow(i + 1);
    } else {
      // Store the value in the uniqueValues object
      uniqueValues.push(value);
    }
  }
}
