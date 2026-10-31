import assert from "node:assert/strict";
import test from "node:test";

import { checkupItemCount, splitHealthCheckup } from "../src/lib/healthCheckup.ts";

// Shaped like the clinic lists staff paste in: asterisks, trailing commas, headings ending in ":".
const PASTED = [
  "Вэлмор нуурын амралттай 5 өдрийн аялал.",
  "",
  "*Эрэгтэйчүүдийн биеийн шинжилгээ үзлэгт хийх зүйлс*  ",
  "Үндсэн үзлэг:   ",
  "Дотор эрүүл мэндийн үзлэг,  ",
  "Зүрхний цахилгаан бичлэг,  ",
  "Хэт авиан шинжилгээ:  ",
  "Хэвлийн дээд хэсгийн хэт авиа: элэг, дэлүү, бөөр  ",
  "Хавдрын маркер: ",
  "альфа-фетопротеин \\AFP\\ ",
  "Жич: Бэлгэнд дараах шинжилгээг өгч байна. ",
  "Комьпютер томографик: ",
  "1. Толгой",
  "2. Цээж,",
  "Энэ дээрх 2 төрлөөс сонгоод аль нэгийг өгнө. ",
  "",
  "*Эмэгтэйчүүдийн биеийн шинжилгээ үзлэгт хийх зүйлс*",
  "Үндсэн үзлэг:",
  "Дотор эрүүл мэндийн үзлэг,",
].join("\n");

test("the intro stays the description; each audience becomes its own list", () => {
  const { intro, lists } = splitHealthCheckup(PASTED);
  assert.equal(intro, "Вэлмор нуурын амралттай 5 өдрийн аялал.");
  assert.deepEqual(lists.map((list) => list.audience), ["Эрэгтэй", "Эмэгтэй"]);
  assert.equal(lists[0].title, "Эрэгтэйчүүдийн биеийн шинжилгээ үзлэгт хийх зүйлс");
});

test("groups, items and details are cleaned of asterisks, slashes and trailing commas", () => {
  const [men] = splitHealthCheckup(PASTED).lists;
  assert.deepEqual(men.groups.map((group) => group.title), ["Үндсэн үзлэг", "Хэт авиан шинжилгээ", "Хавдрын маркер", "Комьпютер томографик"]);
  assert.deepEqual(men.groups[0].items, [
    { label: "Дотор эрүүл мэндийн үзлэг", detail: null },
    { label: "Зүрхний цахилгаан бичлэг", detail: null },
  ]);
  assert.deepEqual(men.groups[1].items, [{ label: "Хэвлийн дээд хэсгийн хэт авиа", detail: "элэг, дэлүү, бөөр" }]);
  assert.deepEqual(men.groups[2].items, [{ label: "альфа-фетопротеин AFP", detail: null }]);
  assert.equal(checkupItemCount(men), 6);
});

test("a 'Жич' remark belongs to the group below it, a closing sentence to the group above", () => {
  const [men] = splitHealthCheckup(PASTED).lists;
  const ct = men.groups[3];
  assert.deepEqual(ct.items.map((item) => item.label), ["Толгой", "Цээж"]);
  assert.deepEqual(ct.notes, ["Бэлгэнд дараах шинжилгээг өгч байна.", "Энэ дээрх 2 төрлөөс сонгоод аль нэгийг өгнө."]);
});

test("ordinary descriptions are left whole", () => {
  const plain = "Далайн эргийн 7 өдрийн аялал.\nӨглөөний цай багтсан.";
  assert.deepEqual(splitHealthCheckup(plain), { intro: plain, lists: [] });
  assert.deepEqual(splitHealthCheckup(""), { intro: "", lists: [] });
  const headingOnly = "Шинжилгээнд багтсан зүйлс:\nДэлгэрэнгүйг утсаар лавлана уу.";
  assert.equal(splitHealthCheckup(headingOnly).lists.length, 0);
  assert.equal(splitHealthCheckup(headingOnly).intro, headingOnly);
});
