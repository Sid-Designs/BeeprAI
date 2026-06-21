import assert from "node:assert/strict";
import test from "node:test";
import { parseContactsFromManualText } from "../services/bulkCall.service.js";

test("parse comma-separated phone and name pairs on one line", () => {
  const contacts = parseContactsFromManualText(
    "+91 7304757117 Siddhesh, +91 7304757117 Rahul",
  );

  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].phoneNumber, "+917304757117");
  assert.equal(contacts[0].name, "Siddhesh");
  assert.equal(contacts[1].name, "Rahul");
});

test("parse newline-separated contacts", () => {
  const contacts = parseContactsFromManualText(
    "+91 7304757117 Siddhesh\n9876543210",
  );

  assert.equal(contacts.length, 2);
  assert.equal(contacts[1].phoneNumber, "+919876543210");
});
