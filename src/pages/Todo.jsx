import { useState, useEffect } from "preact/hooks";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { db } from "../firebase.js";
import { Button } from "../components/Button.jsx";
import { AddTaskModal } from "../components/AddTaskModal.jsx";
import { TodoItem } from "../components/TodoItem.jsx";
import "./Todo.css";

const ALL_LISTS = "all";
const UNCATEGORIZED_LIST = "uncategorized";

export function Todo() {
  const [todos, setTodos] = useState([]);
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(ALL_LISTS);
  const [listPanelIsVisible, setListPanelIsVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [modalIsVisible, setModalIsVisible] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);

  async function loadTodos() {
    const q = query(collection(db, "todos"), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTodos(items);
  }

  async function loadLists() {
    const q = query(collection(db, "lists"), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    setLists(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    Promise.all([loadTodos(), loadLists()]).catch((error) => {
      console.error("Unable to load todos or lists:", error);
    });
  }, []);

  async function createList(event) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) return;

    const duplicate = lists.some(
      (list) => list.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    if (duplicate) return;

    try {
      const result = await addDoc(collection(db, "lists"), {
        name,
        createdAt: serverTimestamp(),
      });
      setLists((previous) => [...previous, { id: result.id, name }]);
      setActiveListId(result.id);
      setNewListName("");
    } catch (error) {
      console.error("Unable to create list:", error);
    }
  }

  async function addTodo(task) {
    const text = task.trim();
    if (text === "") return;

    const listId =
      activeListId === ALL_LISTS || activeListId === UNCATEGORIZED_LIST
        ? null
        : activeListId;
    const tempTodo = {
      id: `temp-${Date.now()}`,
      text,
      completed: false,
      listId,
    };
    setTodos((previous) => [...previous, tempTodo]);
    setModalIsVisible(false);

    try {
      await addDoc(collection(db, "todos"), {
        text,
        completed: false,
        listId,
        createdAt: serverTimestamp(),
      });
      await loadTodos();
    } catch (error) {
      console.error(error);
      setTodos((previous) => previous.filter((todo) => todo.id !== tempTodo.id));
    }
  }

  async function editTodo(id, newText) {
    setTodos((previous) =>
      previous.map((todo) =>
        todo.id === id ? { ...todo, text: newText } : todo
      )
    );
    setEditingId(null);

    try {
      await updateDoc(doc(db, "todos", id), { text: newText });
    } catch (error) {
      console.error(error);
      await loadTodos();
    }
  }

  async function deleteTodo(id) {
    if (deletingIds.includes(id)) return;

    const deletedTodo = todos.find((todo) => todo.id === id);
    if (!deletedTodo) return;

    setDeletingIds((prev) => [...prev, id]);
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    setEditingId((currentId) => (currentId === id ? null : currentId));

    try {
      await deleteDoc(doc(db, "todos", id));
    } catch (e) {
      console.error(e);
      await loadTodos();
    } finally {
      setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id));
    }
  }

  const visibleTodos = todos.filter((todo) => {
    if (activeListId === ALL_LISTS) return true;
    if (activeListId === UNCATEGORIZED_LIST) return !todo.listId;
    return todo.listId === activeListId;
  });

  const listButtonStyle = (isActive) => ({
    border: "1px solid currentColor",
    borderRadius: "8px",
    padding: "0.4rem 0.75rem",
    cursor: "pointer",
    background: isActive ? "var(--todo-nav-btns)" : "transparent",
    color: "inherit",
  });

  return (
    <div>
      <div class="todo-nav">
        <h1>
          {activeListId === ALL_LISTS
            ? "Todo List"
            : activeListId === UNCATEGORIZED_LIST
              ? "Uncategorized"
              : lists.find((list) => list.id === activeListId)?.name || "Todo List"}
        </h1>
        <div class="todo-nav-buttons">
          <Button onClick={() => setModalIsVisible(true)}>Add</Button>
          <Button onClick={() => setListPanelIsVisible((visible) => !visible)}>
            {listPanelIsVisible ? "Hide Lists" : "Lists"}
          </Button>
        </div>
      </div>

      {listPanelIsVisible && (
        <section
          aria-label="Todo lists"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "12px",
            background: "var(--todo-bg)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              style={listButtonStyle(activeListId === ALL_LISTS)}
              aria-pressed={activeListId === ALL_LISTS}
              onClick={() => setActiveListId(ALL_LISTS)}
            >
              All tasks
            </button>
            <button
              type="button"
              style={listButtonStyle(activeListId === UNCATEGORIZED_LIST)}
              aria-pressed={activeListId === UNCATEGORIZED_LIST}
              onClick={() => setActiveListId(UNCATEGORIZED_LIST)}
            >
              Uncategorized
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                style={listButtonStyle(activeListId === list.id)}
                aria-pressed={activeListId === list.id}
                onClick={() => setActiveListId(list.id)}
              >
                {list.name}
              </button>
            ))}
          </div>

          <form onSubmit={createList} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={newListName}
              onInput={(event) => setNewListName(event.currentTarget.value)}
              placeholder="New list name"
              aria-label="New list name"
              maxLength={60}
              style={{ minWidth: 0, flex: 1, padding: "0.5rem" }}
            />
            <button type="submit" style={listButtonStyle(false)}>
              Create list
            </button>
          </form>
          {lists.length === 0 && (
            <p>Create a list to organize new tasks. Existing tasks remain under All tasks or Uncategorized.</p>
          )}
        </section>
      )}

      <div class="todo-list">
        {visibleTodos.length === 0 ? (
          <p>
            {activeListId === ALL_LISTS
              ? "No tasks yet. Add a task to get started."
              : "This list is empty. Add a task to put it here."}
          </p>
        ) : (
          <ul>
            {visibleTodos.map((todo) => (
              <li key={todo.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TodoItem
                      todo={todo}
                      isEditing={todo.id === editingId}
                      onEdit={() => setEditingId(todo.id)}
                      onSave={(newText) => editTodo(todo.id, newText)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                  <button
                    class="btn"
                    type="button"
                    onClick={() => deleteTodo(todo.id)}
                    disabled={deletingIds.includes(todo.id)}
                    aria-label={`Delete ${todo.text}`}
                  >
                    {deletingIds.includes(todo.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddTaskModal
        isOpen={modalIsVisible}
        onClose={() => setModalIsVisible(false)}
        onSave={addTodo}
      />
    </div>
  );
}