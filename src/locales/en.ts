const en = {
  nav: {
    dashboard: "Dashboard",
    tests: "Tests",
    homework: "Homework",
    admin: "Admin",
    settings: "Settings",
  },

  dashboard: {
    title: "Dashboard",
    stats: {
      overallBand: "Overall Band",
      target: "Target: 7.5",
      testsTaken: "Tests Taken",
      testsTakenSub: "This month",
      homeworkDone: "Homework Done",
      homeworkPending: (n: number) => `${n} pending`,
      streak: "Streak",
      streakSub: "days in a row",
    },
    skillBreakdown: {
      title: "Skill Breakdown",
      skills: {
        listening: "Listening",
        reading: "Reading",
        writing: "Writing",
        speaking: "Speaking",
      },
    },
    upcomingHomework: {
      title: "Upcoming Homework",
      urgent: "Urgent",
      upcoming: "Upcoming",
    },
    recentTests: {
      title: "Recent Tests",
      viewAll: "View all",
      status: "Completed",
    },
  },

  tests: {
    title: "Tests",
    filter: {
      placeholder: "Filter",
      all: "All",
      notStarted: "Not Started",
      inProgress: "In Progress",
      completed: "Completed",
    },
    summary: {
      completed: "Completed",
      avgBand: "Avg Band",
      progress: "Progress",
    },
    bookHeader: (num: string) => `Cambridge IELTS ${num} — Academic`,
    noMatch: "No tests match the current filter.",
    card: {
      minDot: (min: number, q: number) => `${min} min · ${q} Q`,
    },
    actions: {
      start: "Start",
      continue: "Continue",
      review: "Review",
    },
    dialog: {
      minutesTotal: (n: number) => `${n} minutes total`,
      questions: (n: number) => `${n} questions`,
      sections: "Sections",
      notAttempted: "Not attempted",
      band: (n: number) => `Band ${n}`,
      cancel: "Cancel",
      startTest: "Start Test",
    },
    status: {
      notStarted: "Not Started",
      inProgress: "In Progress",
      completed: "Completed",
    },
  },

  homework: {
    title: "Homework",
    filter: {
      placeholder: "Subject",
      all: "All",
      writing: "Writing",
      reading: "Reading",
      listening: "Listening",
      speaking: "Speaking",
    },
    tabs: {
      all: "all",
      pending: "pending",
      completed: "completed",
    },
    completion: {
      label: "Completion",
      tasks: (done: number, total: number) => `${done}/${total} tasks`,
    },
    empty: "All caught up!",
    steps: "Steps",
    due: {
      tomorrow: "Due tomorrow — don't forget!",
      daysLeft: (n: number) => `${n} days remaining`,
    },
  },

  settings: {
    sections: {
      account: "Account",
      notifications: "Notifications",
      tests: "Tests",
      dangerZone: "Danger Zone",
    },
    account: {
      role: "Developer",
      language: "Language",
      languageSub: "App display language",
      languageValue: "English",
      password: "Password",
      passwordSub: "Change your account password",
      changePassword: "Change",
      menu: {
        editProfile: "Edit profile",
        changePassword: "Change password",
        signOut: "Sign out",
      },
    },
    signOut: {
      title: "Sign out?",
      description: "You'll need to log in again to access your account.",
      cancel: "Cancel",
      confirm: "Sign out",
    },
    changePassword: {
      title: "Change password?",
      description: "This will log you out of all devices. You'll need to sign in again with your new password.",
      cancel: "Cancel",
      confirm: "Continue",
    },
    notifications: {
      push: "Push Notifications",
      pushSub: "Receive reminders for upcoming tests",
      sound: "Sound",
      soundSub: "Play sounds for alerts and timers",
      timerWarning: "Timer Warning",
      timerWarningSub: "Alert when 5 minutes remain in a test",
    },
    testsSection: {
      autoSubmit: "Auto Submit",
      autoSubmitSub: "Automatically submit when time runs out",
    },
    danger: {
      deleteAccount: "Delete account",
      deleteAccountSub: "Permanently delete your account and all data",
      deleteButton: "Delete",
      dialog: {
        title: "Delete account?",
        description: "This action cannot be undone. All your data, tests, and homework will be permanently deleted.",
        cancel: "Cancel",
        confirm: "Delete account",
      },
    },
  },

  login: {
    title: "Welcome back",
    subtitle: "Sign in to your account",
    bootstrapTitle: "Create admin account",
    bootstrapSubtitle: "Set up the first admin for this workspace",
    signInTab: "Sign in",
    bootstrapTab: "Create admin",
    username: "Username",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    bootstrapAction: "Create admin",
    error: "Invalid username or password.",
    successToast: (u: string) => `Welcome back, ${u}!`,
    bootstrapSuccess: "Admin account created.",
  },

  timer: {
    warning: "5 minutes remaining!",
    finished: "Time's up!",
    warningBody: (name: string) => `5 minutes remaining in ${name}`,
    finishedBody: (name: string) => `Your time for ${name} has ended.`,
  },
} as const;

export default en;
