const express = require("express");
const router = express.Router();
const randomstring = require("randomstring");
const mongoose = require("mongoose");
// const csv = require("csv-parser");
const fs = require("fs");
const math = require("mathjs");
// console.log(__dirname);

let rawdata = fs.readFileSync("./public/data/finalSimData.json");
let jsonData = JSON.parse(rawdata);
// console.log(jsonData);
let dataList = Object.keys(jsonData).map(function (d) {
  return jsonData[d];
});
const variables = dataList.map((d) => {
  return [d["vars"], d["unitt"]];
});
console.log(variables);
const url =
  "mongodb://markant:emotion2019@ds159025.mlab.com:59025/markantstudy";

mongoose.connect(url);
mongoose.promise = global.Promise;

// const db = mongoose.anchoring;

const Schema = mongoose.Schema;

const responseSchema = new Schema({
  usertoken: {
    type: String,
    required: true,
    unique: true,
  },
  variables: Schema.Types.Array,
  date: {
    type: Date,
    default: Date.now,
  },
  responses: Schema.Types.Array,
});

const Response = mongoose.model("variableStudy", responseSchema);

router.get("/api/consent", function (req, res) {
  // 0 is low 1 is high 2 is control //
  // for order 0 is basic anchoring first, then with map visualization and 1 is map visualization first and then basic anchoring//

  if (!req.session.userid) {
    let token = randomstring.generate(8);

    req.session.userid = token;
    //this get incremented and iterates over different variables
    req.session.varIndex = 0;
    //this assigns the orders of variables.
    req.session.variables = shuffle(variables);
    //this assigns the state of the study i.e. elicitation 1, data vis, elicitation 2
    //this assigns a string format of state i.e. draw1, datavis, draw2

    let newResponse = new Response({
      usertoken: token,
      variables: req.session.variables,
    });

    newResponse.save(function (err) {
      if (err) console.log(err);
      res.send({
        user: token,
      });
    });
  } else {
    res.send("consent already given");
  }
});

//returns users token
router.get("/api/userinfo", function (req, res) {
  if (req.session.userid) {
    res.json({
      token: req.session.userid,
    });
  } else {
    res.send("please give consent first");
  }
});

//returns required data for running the expriment.
router.get("/api/data", function (req, res) {
  let variable = req.session.variables[req.session.varIndex];
  console.log(variable);
  // console.log(dataset);
  let varNumber = req.session.varIndex + 1;
  let d = {
    vars: variable[0],
    unit: variable[1],
    varNumber: varNumber,
  };
  res.status(200).send(d);
});

//saves the current state and the variables as well as the responses.
router.post("/api/study", function (req, res) {
  let token = req.session.userid;
  let data = req.body;

  data["variables"] = req.session.variables[req.session.varIndex];

  Response.findOneAndUpdate(
    { usertoken: token },
    {
      $push: { responses: data },
    },
    function (err, doc) {
      if (err) {
        return res.send(500, { error: err });
      }
      return res.send(200, `successfully saved study`);
    }
  );
});

//first page
router.get("/", function (req, res) {
  res.redirect("/consent");
});
// consent page
router.get("/consent", function (req, res) {
  res.render("consent.html");
});

router.get("/intermission", function (req, res) {
  if (req.session.varIndex === req.session.variables.length) {
    res.redirect("debrief");
  } else {
    res.render("intermission.html");
  }
});

router.get("/instructions/correlation", function (req, res) {
  if (req.session.completed) {
    res.render("debrief.html");
  } else {
    res.render("instructionsCorrelation.html");
  }
});

router.get("/instructions/draw", function (req, res) {
  if (req.session.completed) {
    res.render("debrief.html");
  } else {
    res.render("instructionsDraw.html");
  }
});

router.get("/study", function (req, res) {
  res.render("lineChartDraw.html");
});

router.get("/next", function (req, res) {
  if (req.session.varIndex < req.session.variables.length) {
    req.session.varIndex++;
    res.redirect("/intermission");
  } else {
    res.redirect("/debrief");
  }
});

router.get("/debrief", function (req, res) {
  res.render("debrief.html");
});

function zip() {
  let args = [].slice.call(arguments);
  let shortest =
    args.length === 0
      ? []
      : args.reduce(function (a, b) {
          return a.length < b.length ? a : b;
        });

  return shortest.map(function (_, i) {
    return args.map(function (array) {
      return array[i];
    });
  });
}

function shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

async function getVisGroup(participantGroup) {
  let visGroups;
  let visGroup;
  let doc = await VisGroupCount.findOne(
    { [participantGroup]: { $exists: true } },
    { _id: 0 }
  ).exec();

  // return doc;
  // .then(d => {
  //   // FIRST CONSOLE.LOG
  //   return d;
  // })
  // .catch(err => {
  //   return "error occured";
  // });
  let gCounts = doc[participantGroup];
  gCounts = {
    line: gCounts["line"],
    band: gCounts["band"],
    hop: gCounts["hop"],
  };
  visGroups = Object.keys(gCounts).filter((key) => {
    return gCounts[key] < maxEachGroup;
  });

  if (visGroups.length === 0) {
    visGroups = ["line", "hop", "band"];
  }
  visGroup = visGroups[getRandomInt(visGroups.length)];
  console.log(visGroup);
  countVisgroups(participantGroup, visGroup);
  return await visGroup;
}

function countVisgroups(participantGroup, visGroup) {
  console.log(`${participantGroup}.${visGroup}`);
  VisGroupCount.updateOne(
    { [participantGroup]: { $exists: true } },
    { $inc: { [`${participantGroup}.${visGroup}`]: 1 } },
    function (err, result) {
      if (err) {
        console.log("results not added");
      } else {
        console.log("counts added");
      }
    }
  );
}

module.exports = router;
