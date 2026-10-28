const USERS_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

function setStatus(message, state = "") {
  statusMessage.textContent = message;
  if (state) statusMessage.dataset.state = state;
  else delete statusMessage.dataset.state;
}

function renderUsers(list) {
  usersList.replaceChildren();

  list.forEach((user) => {
    const item = document.createElement("li");
    item.className = "user-card";

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    const emailLabel = document.createElement("strong");
    emailLabel.textContent = "Email: ";
    email.append(emailLabel, document.createTextNode(user.email));

    const city = document.createElement("p");
    const cityLabel = document.createElement("strong");
    cityLabel.textContent = "City: ";
    city.append(cityLabel, document.createTextNode(user.address?.city || "Not provided"));

    const company = document.createElement("p");
    const companyLabel = document.createElement("strong");
    companyLabel.textContent = "Company: ";
    company.append(companyLabel, document.createTextNode(user.company?.name || "Not provided"));

    item.append(name, email, city, company);
    usersList.append(item);
  });
}

async function loadUsers() {
  loadButton.disabled = true;
  setStatus("Loading users…");
  usersList.replaceChildren();

  try {
    const response = await fetch(USERS_URL);
    if (!response.ok) {
      throw new Error(`The server returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("The server returned an unexpected response.");
    }

    users = data;
    const searchTerm = filterInput.value.trim().toLowerCase();
    const visibleUsers = filterUsers(searchTerm);
    renderUsers(visibleUsers);

    if (visibleUsers.length === 0) {
      setStatus("No users match your filter.");
    } else {
      setStatus(`Successfully loaded ${users.length} users.`, "success");
    }
  } catch (error) {
    users = [];
    renderUsers([]);
    setStatus("Could not load users. Please check your connection and try again.", "error");
    console.error("Unable to load users:", error);
  } finally {
    loadButton.disabled = false;
  }
}

function filterUsers(searchTerm) {
  if (!searchTerm) return users;
  return users.filter((user) => user.name.toLowerCase().includes(searchTerm));
}

filterInput.addEventListener("input", () => {
  const searchTerm = filterInput.value.trim().toLowerCase();
  const filteredUsers = filterUsers(searchTerm);
  renderUsers(filteredUsers);

  if (users.length === 0) {
    setStatus("Select “Load users” to fetch the user list.");
  } else if (filteredUsers.length === 0) {
    setStatus("No users match your filter.");
  } else {
    setStatus(`Showing ${filteredUsers.length} of ${users.length} users.`, "success");
  }
});

loadButton.addEventListener("click", loadUsers);
