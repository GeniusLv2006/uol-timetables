// First teaching Monday per "academicYear:semester", from
// https://www.liverpool.ac.uk/term-dates/. Semester 2 is omitted until its
// week numbering around the Easter break is confirmed from a real timetable.
export const KNOWN_WEEK_ONE_DATES = {
  "2026/27:1": "2026-09-28",
  "2027/28:1": "2027-09-27",
};

export const DAY_OFFSETS = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
  SUN: 6,
};

export const DESCRIPTION_FIELDS = {
  activity: { label: "Activity Code", prefix: "Activity", field: "activity" },
  deliveryType: { label: "Delivery Type", prefix: "Type", field: "deliveryType" },
  teachingWeeks: { label: "Teaching Weeks", prefix: "Teaching Weeks", field: "teachingWeeks" },
  academic: { label: "Academic", prefix: "Academic", field: "academic" },
  moduleUrl: { label: "Module URL", prefix: "Module", field: "moduleUrl" },
  source: { label: "Timetable Source", prefix: "Source", field: "source" },
};
