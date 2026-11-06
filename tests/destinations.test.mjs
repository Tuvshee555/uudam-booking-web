import assert from "node:assert/strict";
import test from "node:test";

import { destinationCounts, fold, tripDestinations } from "../src/lib/destinations.ts";

const keys = (title, extra = {}) => tripDestinations({ title, ...extra }).map((destination) => destination.key);

test("reads the destination from real catalogue titles", () => {
  assert.deepEqual(keys("ТАЙЛАНД — ПУКЕТ АЯЛАЛ"), ["thailand"]);
  assert.deepEqual(keys("Япон Токио, Фүжи аялал"), ["japan"]);
  assert.deepEqual(keys("ЕГИПЕТ шууд нислэгтэй аялал"), ["egypt"]);
  assert.deepEqual(keys("Турк - Анталяа-Памуккале аялал"), ["turkey"]);
  assert.deepEqual(keys("БАЛИ АРЛЫН АЯЛАЛ"), ["bali"]);
  assert.deepEqual(keys("ШЭНЬЖЭНЬ – ХОНКОНГ – ЖУХАЙ – МАКАО 8 ШӨНӨ 9 ӨДӨР"), ["hong-kong-macau"]);
  assert.deepEqual(keys("ЖИНИНЬ ХАЛУУН РАШААН МИНИ АВАТАР ХӨХ ХОТ-ШИНЖИЛГЭЭТЭЙ АЯЛАЛ"), ["inner-mongolia"]);
});

test("a multi-country cruise lists every country it calls at", () => {
  assert.deepEqual(keys("ЭРЭЭН – БЭЭЖИН – ТЯНЬЖИН – ЧЭЖҮ – ФҮКҮОКА УСАН ОНГОЦНЫ АЯЛАЛ"), ["beijing", "japan", "korea"]);
});

test("the city a trip flies out of is not one of its destinations", () => {
  assert.deepEqual(keys("Хайнан-газар нислэг хосолсон - Хөх хотоос Таврин нислэгтэй - 12 сарын 15, 20, 25"), ["hainan"]);
  assert.deepEqual(keys("ХАЙНАН – ХӨХ ХОТООС ТАВРИН НИСЛЭГТЭЙ - 1"), ["hainan"]);
  assert.deepEqual(keys("ХӨХ ХОТЫН БҮТЭН БИЕИЙН ШИНЖИЛГЭЭТЭЙ АЯЛАЛ"), ["inner-mongolia"], "a genitive form is still the destination");
});

test("inflected names still match, but never inside another word", () => {
  assert.deepEqual(keys("ТАЙЛАНДЫН АЯЛАЛ — БАНГКОК, ТАВРИН"), ["thailand"]);
  assert.deepEqual(keys("Хонобали амралт"), []);
  assert.deepEqual(keys("Фүкүока хотын аялал"), ["japan"], "Fukuoka is not Vietnam's Phu Quoc");
});

test("staff-entered country and city count too", () => {
  assert.deepEqual(keys("Шинэ аялал", { country: "Вьетнам", city: "Дананг" }), ["vietnam"]);
});

test("folding forgives missing Mongolian letters", () => {
  assert.equal(fold("Хөх хот"), fold("хох хот"));
  assert.equal(fold("Фүжи!"), "фужи");
});

test("counts list the most-sold destination first", () => {
  const counts = destinationCounts([
    { title: "ХАЙНАН – ТАВРИН АЯЛАЛ" },
    { title: "хайнан-хайкоу нислэгтэй" },
    { title: "ВЬЕТНАМ — ДАНАНГ АЯЛАЛ" },
  ]);
  assert.deepEqual(counts.map((entry) => [entry.key, entry.count]), [["hainan", 2], ["vietnam", 1]]);
});
