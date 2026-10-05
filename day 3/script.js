// ---------- Starting data ----------
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const VALID_CATEGORIES = ["personal", "work", "study"];

// Lower-cases, trims and collapses repeated spaces so comparisons are fair.
function normalize(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------- 1. searchNotes ----------
function searchNotes(word) {
  const target = String(word).toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(target));
}

// ---------- 2. longestNote ----------
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// ---------- 3. countByCategory ----------
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category] === undefined) {
      counts[note.category] = 0;
    }
    counts[note.category]++;
  }
  return counts;
}

// ---------- 4. getSummary ----------
function getSummary() {
  const counts = countByCategory();
  const word = notes.length === 1 ? "note" : "notes";

  if (notes.length === 0) {
    return `0 ${word}.`;
  }

  const parts = [];
  for (const category of VALID_CATEGORIES) {
    if (counts[category]) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${notes.length} ${word}: ${parts.join(", ")}.`;
}

// ---------- 5. isDuplicate ----------
function isDuplicate(text) {
  const target = normalize(text);
  return notes.some((note) => normalize(note.text) === target);
}

// ---------- 6. addNote ----------
function addNote(text, category) {
  const cleaned = String(text).trim();

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Not added: text must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("Not added: this note already exists.");
    return false;
  }
  if (!VALID_CATEGORIES.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }

  let nextId = 1;
  for (const note of notes) {
    if (note.id >= nextId) {
      nextId = note.id + 1;
    }
  }
  notes.push({ id: nextId, text: cleaned, category: category });
  return true;
}

// =====================================================
// TESTS (expected output is in the comment beside each)
// =====================================================

// --- searchNotes ---
console.log("searchNotes");
console.log(searchNotes("JAVASCRIPT")); // [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]
console.log(searchNotes("the")); // two notes: id 2 and id 3
console.log(searchNotes("xyz")); // [] (no results)

// --- longestNote ---
console.log("longestNote");
console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }
const backup = notes; // keep the real array safe
notes = [];
console.log(longestNote()); // null (no notes)
notes = backup;

// --- countByCategory ---
console.log("countByCategory");
console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory()); // {} (no notes)
notes = backup;

// --- getSummary ---
console.log("getSummary");
console.log(getSummary()); // 5 notes: 2 personal, 1 work, 2 study.
notes = [backup[0]];
console.log(getSummary()); // 1 note: 1 personal.
notes = [];
console.log(getSummary()); // 0 notes.
notes = backup;

// --- isDuplicate ---
console.log("isDuplicate");
console.log(isDuplicate("call mum")); // true (case ignored)
console.log(isDuplicate("  CALL    MUM  ")); // true (extra spaces ignored)
console.log(isDuplicate("Call dad")); // false

// --- addNote ---
console.log("addNote");
console.log(addNote("Plan weekend trip", "personal")); // true
console.log(getSummary()); // 6 notes: 3 personal, 1 work, 2 study.
console.log(addNote("  buy MILK  and bread ", "work")); // logs "Not added: this note already exists." then false
console.log(addNote("", "work")); // logs "Not added: text must be 1-200 characters." then false
console.log(addNote("a".repeat(201), "work")); // logs "Not added: text must be 1-200 characters." then false
console.log(addNote("Learn flexbox", "sports")); // logs "Not added: category must be personal, work or study." then false
console.log(addNote("a".repeat(200), "study")); // true (exactly 200 characters is allowed)
console.log(notes.length); // 7
