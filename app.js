let notes = []; // In-memory storage for notes
let isStarredFilterActive = false;
let isStrikethroughFilterActive = false;

// Function to initialize IndexedDB
function initDB() {
    const request = indexedDB.open('CatNoteDB');

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        let oldVersion = event.oldVersion;
        let newVersion = event.newVersion || db.version;
        // console.log('DB updated from version', oldVersion, 'to', newVersion);
        // console.log('upgrade', db);
if(!db.objectStoreNames.contains('notes')){
        const objectStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('text', 'text', { unique: false });
        objectStore.createIndex('completed', 'completed', { unique: false });
        objectStore.createIndex('order', 'order', { unique: false });
        objectStore.createIndex('favorite', 'favorite', { unique: false }); // Added for favorite notes
    };
}
    request.onsuccess = function (event) {
        db = event.target.result;
        fetchNotes();
         // Log information about the database
            // console.log('success', db);
            // console.log('Database name:', db.name);
            // console.log('Database version:', db.version);
            // console.log('Database size:', db.size / (1024 * 1024), 'MB');
    };

    request.onerror = function (event) {
        console.error('Error opening database:', event.target.error);
    };
}

// Function to add a new note
function addNote() {
    const noteInput = document.getElementById('noteInput');
    const noteText = noteInput.value.trim();

    if (noteText !== '') {
        const transaction = db.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');

        // Get the highest order value
        const orderIndex = objectStore.index('order');
        const request = orderIndex.openCursor(null, 'prev');

        request.onsuccess = function (event) {
            const cursor = event.target.result;
            const newOrder = cursor ? cursor.value.order + 1 : 0; // Increment for the new note

            // Get all notes and increment the order property for each
            const updateRequest = objectStore.openCursor();
            updateRequest.onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    const updatedNote = cursor.value;
                    updatedNote.order += 1;
                    cursor.update(updatedNote);
                    cursor.continue();
                } else {
                    // Create a new note object with order 0
                    const newNote = {
                        text: noteText,
                        completed: false,
                        order: 0,
                        favorite: false, // Default is not favorite
                    };

                    // Add the new note
                    const addRequest = objectStore.add(newNote);

                    addRequest.onsuccess = function () {
                        // Update the displayed notes
                        fetchNotes();

                        // Clear the input field
                        noteInput.value = '';

                        // Clear the savedNote in localStorage
                        localStorage.removeItem('savedNote');
                    };

                    addRequest.onerror = function (event) {
                        console.error('Error adding note:', event.target.error);
                    };
                }
            };
        };
    }
}

// Function to fetch notes from IndexedDB
function fetchNotes() {
    const transaction = db.transaction(['notes'], 'readonly');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.getAll();

    request.onsuccess = function () {
        // Update the in-memory notes array based on filter states
        const allNotes = request.result;

        // Filter notes based on filter states
        const filteredNotes = allNotes.filter(note => {
            const isStarred = isStarredFilterActive ? note.favorite : true;
            const isStrikethrough = isStrikethroughFilterActive ? note.completed : true;

            return isStarred && isStrikethrough;
        });

        // Update the in-memory notes array
        notes = filteredNotes;

        // Update the displayed notes
        displayNotes();
    };

    request.onerror = function (event) {
        console.error('Error fetching notes:', event.target.error);
    };
}

// Function to display notes
function displayNotes() {
    const notesContainer = document.getElementById('notes');
    const noteCountElement = document.getElementById('noteCount');

    // Clear the existing content
    notesContainer.innerHTML = '';

    // Reverse the notes array to display the latest note at the top
    // notes.reverse();
 // Sort notes by order
 notes.sort((a, b) => a.order - b.order);
    // Update the note count
    const noteCount = notes.length;
    noteCountElement.textContent = noteCount === 1 ? '1 note' : `${noteCount} notes`;

    // Loop through the notes array and create HTML elements for each note
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.dataset.noteId = note.id;
        noteElement.classList.add('custom-width-99-percent','flex', 'items-center', 'bg-gray-100', 'p-3', 'mb-2', 'rounded', 'relative'); // Added 'relative' class

        const handle = document.createElement('div');
        handle.innerHTML = '<svg class="handle" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>';
        handle.classList.add('handle-container');

        // Move copy, star, and delete buttons to the far right with tailwind's right-3
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('absolute', 'right-3', 'top-1/2', 'transform', '-translate-y-1/2');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `checkbox-${note.id}`;  // Unique ID for each checkbox
        checkbox.checked = note.completed;
        checkbox.classList.add('mr-2');
        checkbox.addEventListener('change', () => toggleCompleted(note.id, checkbox.checked));

        const noteTextElement = document.createElement('div');
        // Display the HTML raw code without rendering in case of <h1>,<hr> etc. tags in the note
        const truncatedText = note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text;
        noteTextElement.textContent = truncatedText;

        if (note.completed) {
            noteTextElement.classList.add('completed');
        }

        const viewNoteButton = createButtonWithTooltip('<i class="bi bi-play"></i>', 'btn-info', 'ml-2', 'View Note', () => viewNote(note.text));
        const copyButton = createButtonWithTooltip('<i class="bi bi-clipboard"></i>', 'btn-info', 'ml-2', 'Copy', () => copyToClipboard(note.text));
        const deleteButton = createButtonWithTooltip('<i class="bi bi-trash"></i>', 'btn-danger', 'ml-2', 'Delete', () => deleteNote(note.id));
        const favoriteButton = createButtonWithTooltip(`<i class="bi ${note.favorite ? 'bi-star-fill btn-favorite' : 'bi-star'}"></i>`, 'btn-secondary', 'ml-2', note.favorite ? 'Unstar' : 'Star', () => toggleFavorite(note.id));

        buttonsContainer.appendChild(checkbox);
        buttonsContainer.appendChild(viewNoteButton);
        buttonsContainer.appendChild(copyButton);
        buttonsContainer.appendChild(favoriteButton);
        buttonsContainer.appendChild(deleteButton);
        noteElement.appendChild(handle);
        noteElement.appendChild(checkbox);
        noteElement.appendChild(noteTextElement);
        noteElement.appendChild(buttonsContainer);


        notesContainer.appendChild(noteElement);
    });

    // Make the notes container sortable
    Sortable.create(notesContainer, {
        animation: 150,
        handle: '.handle',
        draggable: ".items-center",
        sort: "true",
        onStart: function (evt) {
            // console.log('Drag started:', evt);
            // Remove the custom styles
            evt.from.style.height = 'auto';
            evt.from.style.minHeight = '0';
    
            // Add a class to the dragged item for styling during drag
            evt.from.classList.add('dragging');
        },
        onEnd: function (evt) {
            // console.log('Drag ended:', evt);
            // Remove the class after dragging ends
            evt.from.classList.remove('dragging');
            // console.log('drag evt completed');
            
            // Get the original order of notes (before reversing)
            const originalNotes = [...notes];
            
            // Update the order property in the database after dragging
            const noteId = parseInt(evt.item.dataset.noteId);
            const oldIndex = originalNotes.findIndex(note => note.id === noteId);
            const newIndex = evt.newIndex;
            updateNoteOrder(noteId, oldIndex, newIndex);
        },
        
        // Use the mutationObserver option to avoid deprecated events
        mutationObserver: new MutationObserver((mutations) => {
            // Handle mutations as needed
            // This callback is triggered when changes occur in the DOM
        }),
    });
}

// Function to create a button element
function createButtonWithTooltip(html, btnClass, mlClass, tooltip, onClick) {
    const button = document.createElement('button');
    button.innerHTML = html;
    button.classList.add('btn', btnClass, 'btn-sm', mlClass);
    button.title = tooltip; // Set the tooltip text
    button.onclick = onClick;
    return button;
}

// Function to save edited note text
function saveEditedNoteText(noteId, newText) {
    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.get(noteId);

    request.onsuccess = function () {
        const note = request.result;
        note.text = newText;

        const updateRequest = objectStore.put(note);

        updateRequest.onsuccess = function () {
            // Update the displayed notes
            fetchNotes();
        };

        updateRequest.onerror = function (event) {
            console.error('Error updating note:', event.target.error);
        };
    };

    request.onerror = function (event) {
        console.error('Error getting note:', event.target.error);
    };
}

// Function to toggle completed status
function toggleCompleted(noteId, completed) {
    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.get(noteId);

    request.onsuccess = function () {
        const note = request.result;
        note.completed = completed;

        const updateRequest = objectStore.put(note);

        updateRequest.onsuccess = function () {
            // Update the displayed notes
            fetchNotes();
        };

        updateRequest.onerror = function (event) {
            console.error('Error updating note:', event.target.error);
        };
    };

    request.onerror = function (event) {
        console.error('Error getting note:', event.target.error);
    };
}

// Function to view note in modal window

function toggleFavorite(noteText){
    alert(noteText);
}

// Function to toggle favorite status
function toggleFavorite(noteId) {
    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.get(noteId);

    request.onsuccess = function () {
        const note = request.result;
        note.favorite = !note.favorite; // Toggle favorite status

        const updateRequest = objectStore.put(note);

        updateRequest.onsuccess = function () {
            // Update the displayed notes
            fetchNotes();
        };

        updateRequest.onerror = function (event) {
            console.error('Error updating note:', event.target.error);
        };
    };

    request.onerror = function (event) {
        console.error('Error getting note:', event.target.error);
    };
}
// Function to update the order property of a note
function updateNoteOrder(noteId, oldIndex, newIndex) {
    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');

    const request = objectStore.get(noteId);

    request.onsuccess = function () {
        const note = request.result;

        // Remove the note from its old position
        notes.splice(oldIndex, 1);

        // Update the order in the in-memory notes array
        notes.splice(newIndex, 0, note);

        // Reassign unique order values to all notes
        notes.forEach((note, index) => {
            note.order = index;
            objectStore.put(note);
        });

        // Update the displayed notes
        displayNotes();
    };

    request.onerror = function (event) {
        console.error('Error getting note:', event.target.error);
    };
}



// Function to delete a note
function deleteNote(noteId) {
    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.delete(noteId);

    request.onsuccess = function () {
        // Update the displayed notes
        fetchNotes();
    };

    request.onerror = function (event) {
        console.error('Error deleting note:', event.target.error);
    };
}

// Function to copy note to clipboard
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// Function to toggle dark mode
async function toggleDarkMode() {
    const body = document.body;
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    // Toggle the dark mode class on the body
    body.classList.toggle('dark-mode');

    // Toggle the visibility of dark and light icons
    darkIcon.classList.toggle('hidden');
    lightIcon.classList.toggle('hidden');

    // Save the current mode to localStorage
    const currentMode = body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('darkMode', currentMode);
}

// Function to set initial dark mode state
function setInitialDarkMode() {
    const body = document.body;
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    // Retrieve the mode from localStorage
    const savedMode = localStorage.getItem('darkMode');

    // Set the initial mode based on the saved value
    if (savedMode === 'dark') {
        body.classList.add('dark-mode');
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
    } else {
        body.classList.remove('dark-mode');
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
    }
}
// Attach event listeners
document.getElementById('theme-toggle').addEventListener('click', toggleDarkMode);
document.getElementById('addNoteBtn').addEventListener('click', addNote);
document.addEventListener('DOMContentLoaded', setInitialDarkMode);

document.addEventListener('DOMContentLoaded', function () {
    // Retrieve stored data from localStorage
    const savedNote = localStorage.getItem('savedNote');
    const noteInput = document.getElementById('noteInput');

    // Set the textarea value
    if (savedNote) {
        noteInput.value = savedNote;
    }

    // Save the textarea data when it changes
    noteInput.addEventListener('input', function () {
        localStorage.setItem('savedNote', noteInput.value);
    });
});
document.getElementById('toggleStarred').addEventListener('click', toggleStarredNotes);
document.getElementById('toggleStrikethrough').addEventListener('click', toggleStrikethroughNotes);
document.getElementById('resetFilters').addEventListener('click', resetFilters);

function toggleStarredNotes() {
    const notesContainer = document.getElementById('notes');
    notesContainer.innerHTML = ''; // Clear existing notes

    const starredNotes = notes.filter(note => note.favorite);
    displayFilteredNotes(starredNotes);
}

function toggleStrikethroughNotes() {
    const notesContainer = document.getElementById('notes');
    notesContainer.innerHTML = ''; // Clear existing notes

    const strikethroughNotes = notes.filter(note => note.completed);
    displayFilteredNotes(strikethroughNotes);
}

// Function to reset filters
function resetFilters() {
    const notesContainer = document.getElementById('notes');
    notesContainer.innerHTML = ''; // Clear existing notes

    // Reset filter states
    isStarredFilterActive = false;
    isStrikethroughFilterActive = false;

    // Update button appearances
    updateButtonAppearance(document.getElementById('toggleStarred'), false);
    updateButtonAppearance(document.getElementById('toggleStrikethrough'), false);

    // Fetch all notes
    fetchNotes();
}

function displayFilteredNotes(filteredNotes) {
    const notesContainer = document.getElementById('notes');

    filteredNotes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.dataset.noteId = note.id;
        noteElement.classList.add('custom-width-99-percent','flex', 'items-center', 'bg-gray-100', 'p-3', 'mb-2', 'rounded');

        const handle = document.createElement('div');
        handle.innerHTML = '<svg class="handle" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>';
        handle.classList.add('handle-container');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `checkbox-${note.id}`;
        checkbox.checked = note.completed;
        checkbox.classList.add('mr-2');
        checkbox.addEventListener('change', () => toggleCompleted(note.id, checkbox.checked));

        const noteTextElement = document.createElement('div');
        const truncatedText = note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text;
        noteTextElement.textContent = truncatedText;

        if (note.completed) {
            noteTextElement.classList.add('completed');
        }

        const viewNoteButton = createButtonWithTooltip('<i class="bi bi-play"></i>', 'btn-info', 'ml-2', 'View Note', () => viewNote(note.text));
        const copyButton = createButtonWithTooltip('<i class="bi bi-clipboard"></i>', 'btn-info', 'ml-2', 'Copy', () => copyToClipboard(note.text));
        const deleteButton = createButtonWithTooltip('<i class="bi bi-trash"></i>', 'btn-danger', 'ml-2', 'Delete', () => deleteNote(note.id));
        const favoriteButton = createButtonWithTooltip(`<i class="bi ${note.favorite ? 'bi-star-fill btn-favorite' : 'bi-star'}"></i>`, 'btn-secondary', 'ml-2', note.favorite ? 'Unstar' : 'Star', () => toggleFavorite(note.id));

        noteElement.appendChild(handle);
        noteElement.appendChild(checkbox);
        noteElement.appendChild(noteTextElement);
        noteElement.appendChild(viewNoteButton);
        noteElement.appendChild(copyButton);
        noteElement.appendChild(favoriteButton);
        noteElement.appendChild(deleteButton);

        notesContainer.appendChild(noteElement);
    });


}

// Function to toggle filter state and update button appearance
function toggleFilterState(buttonElement, filterState) {
    filterState = !filterState; // Toggle the filter state
    updateButtonAppearance(buttonElement, filterState);

    // Fetch notes with filters
    fetchNotes();
}

// Function to fetch notes from IndexedDB with filters
function fetchNotesWithFilters() {
    const transaction = db.transaction(['notes'], 'readonly');
    const objectStore = transaction.objectStore('notes');

    const request = objectStore.getAll();

    request.onsuccess = function () {
        // Update the in-memory notes array
        notes = request.result;

        // Apply filters
        if (isStarredFilterActive) {
            notes = notes.filter(note => note.favorite);
        } else if (isStrikethroughFilterActive) {
            notes = notes.filter(note => note.completed);
        }

        // Update the displayed notes
        displayNotes();
    };

    request.onerror = function (event) {
        console.error('Error fetching notes:', event.target.error);
    };
}

// Function to update button appearance based on filter state
function updateButtonAppearance(buttonElement, filterState) {
    if (filterState) {
        buttonElement.classList.add('btn-pressed');
    } else {
        buttonElement.classList.remove('btn-pressed');
    }
}

// Attach event listeners to filter buttons
document.getElementById('toggleStarred').addEventListener('click', function () {
    toggleFilterState(this, isStarredFilterActive);
    isStarredFilterActive = !isStarredFilterActive;
});

document.getElementById('toggleStrikethrough').addEventListener('click', function () {
    toggleFilterState(this, isStrikethroughFilterActive);
    isStrikethroughFilterActive = !isStrikethroughFilterActive;
});

function setInitialFilterStates() {
    const savedStarredState = localStorage.getItem('starredFilterState');
    const savedStrikethroughState = localStorage.getItem('strikethroughFilterState');

    isStarredFilterActive = savedStarredState === 'true';
    isStrikethroughFilterActive = savedStrikethroughState === 'true';
}

//setInitialFilterStates(); // Call this function on page load to set initial filter states


// Initialize IndexedDB and fetch notes
let db;
initDB();