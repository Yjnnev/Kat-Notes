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

export function Todo() {
  const [todos, setTodos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [modalIsVisible, setModalIsVisible] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);

  async function loadTodos() {
    const q = query(collection(db, "todos"), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTodos(items);
  }

  useEffect(() => {
    loadTodos();
  }, []);

  async function addTodo(task) {
    const text = task.trim();
    if (text === "") return;

    const tempTodo = { id: `temp-${Date.now()}`, text, completed: false };
    setTodos((prev) => [...prev, tempTodo]);
    setModalIsVisible(false);

    try {
      await addDoc(collection(db, "todos"), {
        text,
        completed: false,
        createdAt: serverTimestamp(),
      });
      await loadTodos();
    } catch (e) {
      console.error(e);
      setTodos((prev) => prev.filter((t) => t.id !== tempTodo.id));
    }
  }

  async function editTodo(id, newText) {
    setTodos((prev) =>
      prev.map((todoItem) =>
        todoItem.id === id ? { ...todoItem, text: newText } : todoItem
      )
    );
    setEditingId(null);

    try {
      await updateDoc(doc(db, "todos", id), { text: newText });
    } catch (e) {
      console.error(e);
      await loadTodos();
    }
  }

  return (
    <div>
      <div class="todo-nav">
        <h1>Todo List</h1>
        <div class="todo-nav-buttons">
          <Button onClick={() => setModalIsVisible(true)}>Add</Button>
          <Button onClick={() => console.log("clicked!")}>Lists</Button>
        </div>
      </div>

      <div class="todo-list">
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              <TodoItem
                todo={todo}
                isEditing={todo.id === editingId}
                onEdit={() => setEditingId(todo.id)}
                onSave={(newText) => editTodo(todo.id, newText)}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ))}
        </ul>
      </div>

      <AddTaskModal
        isOpen={modalIsVisible}
        onClose={() => setModalIsVisible(false)}
        onSave={addTodo}
      />
    </div>
  );
}