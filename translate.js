let GRAMMAR = {};
let DICT = {};
let ALPHABET = [];

// Load JSON files
Promise.all([
  fetch("data/grammar_v2.json").then(r => r.json()),
  fetch("data/dictionary.json").then(r => r.json()),
  fetch("data/alphabet.json").then(r => r.json())
]).then(([g, d, a]) => {
  GRAMMAR = g;
  DICT = d;
  ALPHABET = a.alphabet;
  console.log("Grammar, Dictionary, Alphabet loaded");
}).catch(err => {
  console.error("Error loading JSON files:", err);
});

// --- Transliteration fallback ---
function transliterate(word) {
  let result = "";
  let i = 0;

  while (i < word.length) {
    let two = word.slice(i, i + 2);
    let match = ALPHABET.find(x => x.english === two);

    if (match) {
      result += match.zeme;
      i += 2;
      continue;
    }

    let one = word[i];
    match = ALPHABET.find(x => x.english === one);

    if (match) {
      result += match.zeme;
    } else {
      result += one;
    }

    i++;
  }

  return result;
}

// Normalize verbs (worked → work, working → work)
function normalizeVerb(word) {
  if (word === "came") return "come";
  if (word.endsWith("ed")) return word.slice(0, -2);
  if (word.endsWith("ing")) return word.slice(0, -3);
  return word;
}


// Detect helpers
function detectPast(text) {
  return text.includes("did ") || text.includes("ed");
}

function detectFuture(text) {
  return text.includes("will ");
}

function detectNegative(text) {
  return text.includes(" not ");
}

function detectContinuous(text) {
  return text.includes("ing");
}

function detectWH(text) {
  return text.startsWith("who ") ||
         text.startsWith("what ") ||
         text.startsWith("where ") ||
         text.startsWith("when ") ||
         text.startsWith("why ") ||
         text.startsWith("how ") ||
         text.startsWith("when ");

}

// --- Identity Question Handler ---
function handleIdentityQuestion(clean) {
  let parts = clean.split(" ");

  // Who are you?
  if (clean === "who are you" || clean === "who is you") {
    return "nang " +
      GRAMMAR.questionWords.who + " " +
      GRAMMAR.endings.whQuestion;
  }

  // What is your name?
  if (clean === "what is your name") {
    return "nang ji " +
      GRAMMAR.questionWords.who + " " +
      GRAMMAR.endings.whQuestion;
  }

  // Who is your X?
  if (clean.startsWith("who is your ")) {
    let noun = parts[3];
    let translated =
      DICT.words[noun] || transliterate(noun);

    return "nang " +
      translated + " " +
      GRAMMAR.questionWords.who + " " +
      GRAMMAR.endings.whQuestion;
  }

  // Who is he?
  if (clean === "who is he") {
    return GRAMMAR.pronouns["he"] + " " +
      GRAMMAR.questionWords.who + " " +
      GRAMMAR.endings.whQuestion;
  }

  return null;
}

function translateText(text) {
  if (!text) return "";

  if (!GRAMMAR.ignore_words || !DICT.words || ALPHABET.length === 0) {
    return "Translation engine not ready yet!";
  }

  let original = text.toLowerCase().trim();
  let isQuestion = original.endsWith("?");
  let clean = original.replace("?", "");
// --- WHO / HOW direct handling ---
if (clean.startsWith("who ")) {

  if (clean.includes("they")) return "penui ze châu lau";
  if (clean.includes("he")) return "pa ze châu lau";
  if (clean.includes("you")) return "nang ze châu lau";
  if (clean.includes("i")) return "I ze châu lau";

}

if (clean.startsWith("how ")) {

  if (clean.includes("they")) return "penui ndaigum lau";
  if (clean.includes("he")) return "pa ndaigum lau";
  if (clean.includes("you")) return "nang ndaigum lau";
  if (clean.includes("i")) return "I ndaigum lau";

}

  // Phrase priority
  if (DICT.phrases && DICT.phrases[clean]) {
    return DICT.phrases[clean];
  }

  // Identity questions
  let identityResult = handleIdentityQuestion(clean);
  if (identityResult) return identityResult;

  let isPast = detectPast(clean);
  let isFuture = detectFuture(clean);
  let isNegative = detectNegative(clean);
  let isContinuous = detectContinuous(clean);
  let isWH = detectWH(clean);

  let words = clean
    .split(/\s+/)
    .filter(w =>
      !["will", "did", "not", "are", "is", "was", "were", "am"].includes(w)
    )
    .map(w => normalizeVerb(w));

  let translatedParts = [];

  words.forEach(w => {

    if (GRAMMAR.ignore_words.includes(w)) return;
    if (GRAMMAR.be_verbs[w] !== undefined) return;

    if (GRAMMAR.objectPronouns && GRAMMAR.objectPronouns[w]) {
      translatedParts.push(GRAMMAR.objectPronouns[w]);
      return;
    }

    if (GRAMMAR.pronouns && GRAMMAR.pronouns[w]) {
      translatedParts.push(GRAMMAR.pronouns[w]);
      return;
    }

    if (GRAMMAR.prepositions[w]) {
      translatedParts.push(GRAMMAR.prepositions[w]);
      return;
    }

    if (w === "work") {
      translatedParts.push(DICT.words["work"]);
      translatedParts.push(GRAMMAR.verbs["do"]);
      return;
    }

    if (GRAMMAR.verbs[w]) {
      translatedParts.push(GRAMMAR.verbs[w]);
      return;
    }

    if (GRAMMAR.plural[w]) {
      translatedParts.push(GRAMMAR.plural[w]);
      return;
    }

    if (DICT.words[w]) {
      translatedParts.push(DICT.words[w]);
      return;
    }

    translatedParts.push(transliterate(w));
  });

  // ✅ SAFETY CHECK
  if (translatedParts.length === 0) return "";
let subject = translatedParts[0];
let rest = translatedParts.slice(1);
let sentence = "";   // ✅ just declared sentence
// --- WHO / HOW handling (FINAL RULE) ---
if (isWH) {

  // WHO questions (identity)
  if (clean.startsWith("who ")) {
    return subject + " ze châu lau";
  }

  // HOW questions (condition)
  if (clean.startsWith("how ")) {
    return subject + " ndaigum lau";
  }
}

// Move last word (verb) to end
if (rest.length >= 2) {
  let verb = rest[0];
  let object = rest.slice(1).join(" ");
  sentence = subject + " " + object + " " + verb;
} else {
  sentence = translatedParts.join(" ");  // ✅ fallback
}


  // Special: location identity (Where are you?)
  if (isWH && clean.includes("where") && !isContinuous && !isPast) {
    sentence += " " + GRAMMAR.tenseMarkers.presentContinuous;
  }

  // -------- ADD TENSE MARKERS FIRST --------

  if (isPast && isNegative) {
    sentence += " " +
      GRAMMAR.negative.marker + " " +
      GRAMMAR.tenseMarkers.pastNegativeAspect;
  }
  else if (isPast) {
    sentence += " " +
      GRAMMAR.tenseMarkers.past + " " +
      GRAMMAR.endings.past;
    return sentence;
  }
  else if (isFuture) {
    sentence += " " +
      GRAMMAR.tenseMarkers.future;
  }
  else if (isContinuous && !isPast) {
    sentence += " " +
      GRAMMAR.tenseMarkers.presentContinuous;
  }
  else if (isNegative) {
    sentence += " " +
      GRAMMAR.negative.marker;
  }

  // -------- NOW DECIDE ENDING --------

  if (isWH) {
    return sentence + " " + GRAMMAR.endings.whQuestion;
  }

  if (isQuestion) {
    return sentence + " " + GRAMMAR.endings.yesNoQuestion;
  }

  return sentence + " " + GRAMMAR.endings.present;
}

window.translateText = translateText;

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("translateBtn").addEventListener("click", function () {
    const input = document.getElementById("inp").value;
    const result = translateText(input);
    document.getElementById("out").value = result;
    console.log("Input:", input, "Output:", result);
  });
});
