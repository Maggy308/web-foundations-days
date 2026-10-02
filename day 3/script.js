let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];
searchNotes(word)
function searchNotes(word) {
  return notes.filter(note =>
    note.text.toLowerCase().includes(word.toLowerCase())
  );
}
console.log(searchNotes("JavaScript")); // Expected: [{ id: 4, text: "Revise JavaScript arrays", category: "study" }]
console.log(searchNotes("xyz")); // Expected: []
