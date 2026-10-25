const fs = require('fs');
const p = 'scripts/seed-levels.mjs';
let s = fs.readFileSync(p,'utf8');
const old = `  // A second teacher with no login, so the timetable clash rule has something
  // to collide with.
  const secondStaffId = `${config.staffPrefix}/STF/2026/002`;
  let secondTeacher = await firstRow("teachers", { school_id: schoolId, staff_id: secondStaffId });
  if (!secondTeacher) {
    secondTeacher = await insert("teachers", {
      school_id: schoolId,
      staff_id: secondStaffId,
      title: "Mrs.",
      display_name: "Adesuwa Nwosu",
    });
  }`;
const neu = `  // A second teacher with no login, so the timetable clash rule has something
  // to collide with.
  const secondStaffId = `${config.staffPrefix}/STF/2026/002`;
  let secondTeacher = await firstRow("teachers", { school_id: schoolId, staff_id: secondStaffId });
  if (!secondTeacher) {
    try {
      secondTeacher = await insert("teachers", {
        school_id: schoolId,
        staff_id: secondStaffId,
        title: "Mrs.",
        display_name: "Adesuwa Nwosu",
      });
    } catch(e) {
      secondTeacher = await firstRow("teachers", { school_id: schoolId, staff_id: secondStaffId });
      if (!secondTeacher) throw e;
    }
  }`;
if(!s.includes(old)){ console.log('no'); process.exit(1); }
s = s.split(old).join(neu);
fs.writeFileSync(p,s);
console.log('ok');
