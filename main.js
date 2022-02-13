let clientID = ""// client id from azure,
  redirectURI = "http://localhost:1337/auth",
  clientSecret = ""// client secret from azure;

// Microsoft OAuth Flow
let link = `https://login.live.com/oauth20_authorize.srf?client_id=${clientID}&response_type=code&redirect_uri=${redirectURI}&scope=XboxLive.signin%20offline_access`;

const express = require("express");
const app = express();

var needle = require("needle");

app.get("/auth", function (req, res) {
  res.send("succes");
  let codegoeshere = req.url.replace("/auth?code=", "");
  console.log("codegoeshere: " + codegoeshere);
  // Authorization Code -> Authorization Token
  needle.post(
    "https://login.live.com/oauth20_token.srf",
    {
      client_id: clientID,
      client_secret: clientSecret,
      code: codegoeshere,
      grant_type: "authorization_code",
      redirect_uri: redirectURI,
    },
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    function (err, resp) {
      if (err) throw err;
      let refreshToken = resp.body.refresh_token;
      console.log("refreshToken: " + refreshToken);
      // Refreshing Tokens
      needle.post(
        "https://login.live.com/oauth20_token.srf",
        {
          client_id: clientID,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          redirect_uri: redirectURI,
        },
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        function (err0, resp0) {
          if (err0) throw err;
          let accessToken = resp0.body.access_token;
          console.log("accessToken: " + accessToken);
          // Authenticate with XBL
          needle.post(
            "https://user.auth.xboxlive.com/user/authenticate",
            {
              Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: `d=${accessToken}`,
              },
              RelyingParty: "http://auth.xboxlive.com",
              TokenType: "JWT",
            },
            {
              headers: { "Content-Type": "application/json" },
              Accept: "application / json",
            },
            function (err1, resp1) {
              if (err1) throw err1;
              let xblToken = resp1.body.Token;
              let userhash = resp1.body.DisplayClaims.xui[0].uhs;
              console.log("xblToken: " + xblToken);
              console.log("userhash: " + userhash);
              // Authenticate with XSTS
              needle.post(
                "https://xsts.auth.xboxlive.com/xsts/authorize",
                {
                  Properties: {
                    SandboxId: "RETAIL",
                    UserTokens: [xblToken],
                  },
                  RelyingParty: "rp://api.minecraftservices.com/",
                  TokenType: "JWT",
                },
                {
                  headers: { "Content-Type": "application/json" },
                  Accept: "application / json",
                },
                function (err2, resp2) {
                  if (err2) throw err2;
                  let xstsToken = resp2.body.Token;
                  console.log("xstsToken: " + xstsToken);
                  // Authenticate with Minecraft
                  needle.post(
                    "https://api.minecraftservices.com/authentication/login_with_xbox",
                    {
                      identityToken: `XBL3.0 x=${userhash};${xstsToken}`,
                    },
                    {
                      headers: { "Content-Type": "application/json" },
                      Accept: "application / json",
                    },
                    function (err3, resp3) {
                      if (err3) throw err3;
                      let username = resp3.body.username;
                      let accesToken = resp3.body.access_token;
                      console.log("username: " + username);
                      console.log("access_token: " + accesToken);
                      needle.get(
                        "https://api.minecraftservices.com/entitlements/mcstore",
                        {
                          headers: { Authorization: "Bearer " + accesToken },
                        },
                        function (err4, resp4) {
                          if (err4) throw err4;
                          let haveMinecraft = false;
                          if (resp4.body.items.length / 2 >= 1) {
                            haveMinecraft = true;
                          }
                          console.log("have minecraft?: " + haveMinecraft);
                          if (haveMinecraft) {
                            needle.get(
                              "https://api.minecraftservices.com/minecraft/profile",
                              {
                                headers: {
                                  Authorization: "Bearer " + accesToken,
                                },
                              },
                              function (err5, resp5) {
                                if (err5) throw err5;
                                let minecraftID = resp5.body.id;
                                let minecraftName = resp5.body.name;
                                console.log("minecraft nick: " + minecraftName);
                                console.log("minecraft id: " + minecraftID);
                              }
                            );
                          } else {
                            throw new Error("u dont have minecraft");
                          }
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

app.listen(1337);
console.log(link);
