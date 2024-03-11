// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

import { OAuth2Client } from "google-auth-library";
import http from "http";
import url from "url";
import opn from "opn";
import { GoogleSpreadsheet } from "google-spreadsheet";

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

/**
 * Start by acquiring a pre-authenticated oAuth2 client.
 */
export async function openSpreadsheet(spreadSheetId) {
  const oAuth2Client = await getAuthenticatedClient();

  const doc = new GoogleSpreadsheet(spreadSheetId, oAuth2Client);
  await doc.loadInfo(); // loads document properties and worksheets
  return doc;
}

function findOutlier(arr) {
  // Sort the array
  arr.sort((a, b) => a.diff - b.diff);

  // Calculate the first and third quartiles (Q1 and Q3)
  const q1 = quartile(
    arr.map((obj) => obj.diff),
    0.25
  );
  const q3 = quartile(
    arr.map((obj) => obj.diff),
    0.75
  );

  // Calculate the interquartile range (IQR)
  const iqr = q3 - q1;

  // Define lower and upper bounds for outliers
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Find outliers
  const outliers = arr.filter((obj) => obj.diff < lowerBound);
  if (outliers.length === 1) {
    return outliers[0].key;
  } else {
    return null;
  }
}

// Function to calculate a specific quartile of an array
function quartile(arr, q) {
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + rest * (arr[base + 1] - arr[base]);
  } else {
    return arr[base];
  }
}

export async function writeMatchesToRemoteSheet(doc, imagePath, matches = []) {
  if (matches.length > 1) {
    const sheet = doc.sheetsByTitle["Unmatched"];
    await sheet.addRow([imagePath, matches.join(", ")]);
    console.log(`Multiple matches found for ${imagePath.slice(-20)}`);
  } else if (matches.length === 0) {
    const sheet = doc.sheetsByTitle["Unmatched"];
    await sheet.addRow([imagePath, "No clear match"]);
    console.log(`No match found for ${imagePath.slice(-20)}`);
  } else if (matches.length === 1) {
    const sheet = doc.sheetsByTitle["Sheet1"];
    const rows = await sheet.getRows();
    rows.forEach(async (row) => {
      if (row.get("Key") === matches[0]) {
        row.set("Image URI", imagePath);
        await row.save();
      }
    });
    console.log(`Matched ${imagePath.slice(-20)} to ${matches[0]}`);
  }
}

// await writeMatchesToRemoteSheet(["pretend-key-1"]);

// Make a simple request to the People API using our pre-authenticated client. The `request()` method
// takes an GaxiosOptions object.  Visit https://github.com/JustinBeckwith/gaxios.
// const url = "https://people.googleapis.com/v1/people/me?personFields=names";
// const res = await oAuth2Client.request({ url });
// console.log(res.data);

// // After acquiring an access_token, you may want to check on the audience, expiration,
// // or original scopes requested.  You can do that with the `getTokenInfo` method.
// const tokenInfo = await oAuth2Client.getTokenInfo(
//   oAuth2Client.credentials.access_token
// );
// console.log(tokenInfo);
