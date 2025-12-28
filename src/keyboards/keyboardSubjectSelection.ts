export function keyboardSubjectSelection(selected: string[], allSubjects: string[]): { text: string; callback_data: string }[][] {
  const selectedSet = new Set(selected);
  const rows: { text: string; callback_data: string }[][] = allSubjects.map(subject => [
    {
      text: (selectedSet.has(subject) ? "✅ " : "⬜ ") + subject,
      callback_data: `toggle_${subject}`,
    },
  ]);

  rows.push(
    [{ text: "Готово", callback_data: "subjects_done" }],
    [{ text: "Позже", callback_data: "subjects_cancel" }]
  );

  return rows;
}