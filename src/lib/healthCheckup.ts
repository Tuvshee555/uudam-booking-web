/**
 * Health-checkup trips carry the clinic's test list as pasted text: a heading
 * per audience ("Эрэгтэйчүүдийн биеийн шинжилгээ үзлэгт хийх зүйлс"), group
 * headings ending in ":", one test per line, "Жич:" remarks and stray
 * markdown asterisks. Shown as one paragraph it is unreadable, so the trip page
 * splits it out of the description and renders it as grouped lists.
 */
export type CheckupItem = { label: string; detail: string | null };
export type CheckupGroup = { title: string; items: CheckupItem[]; notes: string[] };
export type CheckupList = { title: string; audience: string; groups: CheckupGroup[]; notes: string[] };
export type CheckupSplit = { intro: string; lists: CheckupList[] };

// "...биеийн шинжилгээ үзлэгт хийх зүйлс", "Эмэгтэйчүүдийн шинжилгээнд багтсан зүйлс"
const LIST_HEADING = /(шинжилгээ|үзлэг)\S*\s.*(хийх|багтсан|орох)\s+зүйл/i;
const NOTE = /^жич\s*[:：.-]\s*/i;

function clean(line: string): string {
  return line
    .replace(/[*\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,，;]+$/, "")
    .trim();
}

function audienceOf(title: string): string {
  if (/эрэгтэй/i.test(title)) return "Эрэгтэй";
  if (/эмэгтэй/i.test(title)) return "Эмэгтэй";
  if (/хүүхд/i.test(title)) return "Хүүхэд";
  return "Шинжилгээ";
}

/** A finished sentence, not a test name: "Энэ дээрх 4 төрлийн СТ-ээс сонгоод аль нэгийг өгнө." */
function isSentence(line: string): boolean {
  return /[.!?]$/.test(line) && line.split(" ").length >= 3;
}

export function splitHealthCheckup(text: string | null | undefined): CheckupSplit {
  const lines = String(text ?? "").split(/\r?\n/);
  const intro: string[] = [];
  const lists: CheckupList[] = [];
  // The list and group being filled; notes wait for the group they introduce.
  const at: { list: CheckupList | null; group: CheckupGroup | null; pending: string[] } = { list: null, group: null, pending: [] };

  const openGroup = (list: CheckupList, title: string): CheckupGroup => {
    const group: CheckupGroup = { title, items: [], notes: at.pending };
    at.pending = [];
    list.groups.push(group);
    at.group = group;
    return group;
  };

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    if (LIST_HEADING.test(line) && line.length <= 120) {
      at.list?.notes.push(...at.pending);
      at.pending = [];
      const title = line.replace(/[:：]$/, "").trim();
      at.list = { title, audience: audienceOf(title), groups: [], notes: [] };
      at.group = null;
      lists.push(at.list);
      continue;
    }
    const list = at.list;
    if (!list) {
      intro.push(raw.replace(/[*]/g, "").trimEnd());
      continue;
    }
    if (NOTE.test(line)) {
      // "Жич: Бэлгэнд дараах ... шинжилгээг өгч байна." introduces the group below it.
      at.pending.push(line.replace(NOTE, "").trim());
      at.group = null;
      continue;
    }
    if (/[:：]$/.test(line)) {
      openGroup(list, line.replace(/[:：]$/, "").trim());
      continue;
    }
    if (isSentence(line)) {
      if (at.group) at.group.notes.push(line);
      else at.pending.push(line);
      continue;
    }
    const numbered = line.replace(/^\d+\s*[.)]\s*/, "");
    const colon = numbered.search(/[:：]/);
    const item: CheckupItem = colon > 0 && colon < numbered.length - 1
      ? { label: numbered.slice(0, colon).trim(), detail: numbered.slice(colon + 1).trim() }
      : { label: numbered, detail: null };
    (at.group ?? openGroup(list, "")).items.push(item);
  }
  at.list?.notes.push(...at.pending);

  const found = lists.filter((entry) => entry.groups.some((group) => group.items.length > 0));
  // A heading with no tests under it is ordinary text: keep the description whole.
  if (!found.length) return { intro: String(text ?? "").replace(/[*]/g, "").trim(), lists: [] };
  return { intro: intro.join("\n").replace(/\n{3,}/g, "\n\n").trim(), lists: found };
}

/** Number of tests in a list, for the audience switch. */
export function checkupItemCount(list: CheckupList): number {
  return list.groups.reduce((sum, group) => sum + group.items.length, 0);
}
