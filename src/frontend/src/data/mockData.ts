export type UserStatus = "online" | "away" | "offline";

export interface User {
  id: string;
  name: string;
  role: string;
  handle: string;
  status: UserStatus;
  mutualConnections: number;
  color: string; // For avatar background
  initials: string;
}

export interface Message {
  id: string;
  senderId: string; // "me" or user id
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  lastMessage: string;
  lastTime: string;
  unread: number;
}

export interface Group {
  id: string;
  name: string;
  memberCount: number;
  lastMessage: string;
  lastTime: string;
  color: string;
  initials: string;
}

export const CURRENT_USER = {
  id: "me",
  name: "Jordan Lee",
  handle: "@jordanlee",
  status: "online" as UserStatus,
  initials: "JL",
  color: "#2F6FE3",
};

export const USERS: User[] = [
  {
    id: "u1",
    name: "Alice Chen",
    role: "Product Designer",
    handle: "@alicechen",
    status: "online",
    mutualConnections: 12,
    color: "#9B59B6",
    initials: "AC",
  },
  {
    id: "u2",
    name: "Bob Martinez",
    role: "Senior Engineer",
    handle: "@bobmartinez",
    status: "online",
    mutualConnections: 8,
    color: "#E67E22",
    initials: "BM",
  },
  {
    id: "u3",
    name: "Carol White",
    role: "Product Manager",
    handle: "@carolwhite",
    status: "away",
    mutualConnections: 15,
    color: "#1ABC9C",
    initials: "CW",
  },
  {
    id: "u4",
    name: "David Kim",
    role: "Full-Stack Developer",
    handle: "@davidkim",
    status: "online",
    mutualConnections: 6,
    color: "#E74C3C",
    initials: "DK",
  },
  {
    id: "u5",
    name: "Emma Johnson",
    role: "Marketing Lead",
    handle: "@emmajohnson",
    status: "away",
    mutualConnections: 20,
    color: "#F39C12",
    initials: "EJ",
  },
  {
    id: "u6",
    name: "Frank Lee",
    role: "Sales Director",
    handle: "@franklee",
    status: "offline",
    mutualConnections: 4,
    color: "#27AE60",
    initials: "FL",
  },
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    userId: "u1",
    lastMessage: "That design looks amazing! 🎨",
    lastTime: "2:41 PM",
    unread: 2,
    messages: [
      {
        id: "m1",
        senderId: "u1",
        text: "Hey! Did you see the new Figma update?",
        timestamp: "2:30 PM",
        read: true,
      },
      {
        id: "m2",
        senderId: "me",
        text: "Yes! The new variables feature is a game changer 🔥",
        timestamp: "2:32 PM",
        read: true,
      },
      {
        id: "m3",
        senderId: "u1",
        text: "Exactly! I've been redesigning the dashboard with it.",
        timestamp: "2:35 PM",
        read: true,
      },
      {
        id: "m4",
        senderId: "me",
        text: "Can you share a preview when it's ready?",
        timestamp: "2:38 PM",
        read: true,
      },
      {
        id: "m5",
        senderId: "u1",
        text: "That design looks amazing! 🎨",
        timestamp: "2:41 PM",
        read: false,
      },
    ],
  },
  {
    id: "c2",
    userId: "u2",
    lastMessage: "The PR is ready for review",
    lastTime: "1:15 PM",
    unread: 0,
    messages: [
      {
        id: "m1",
        senderId: "me",
        text: "Hey Bob, any updates on the API refactor?",
        timestamp: "12:00 PM",
        read: true,
      },
      {
        id: "m2",
        senderId: "u2",
        text: "Almost done! Just writing tests.",
        timestamp: "12:45 PM",
        read: true,
      },
      {
        id: "m3",
        senderId: "u2",
        text: "Found a tricky race condition though 🐛",
        timestamp: "1:00 PM",
        read: true,
      },
      {
        id: "m4",
        senderId: "me",
        text: "Nice catch! Let me know if you need help.",
        timestamp: "1:10 PM",
        read: true,
      },
      {
        id: "m5",
        senderId: "u2",
        text: "The PR is ready for review",
        timestamp: "1:15 PM",
        read: true,
      },
    ],
  },
  {
    id: "c3",
    userId: "u3",
    lastMessage: "Sprint planning at 3pm today",
    lastTime: "11:30 AM",
    unread: 1,
    messages: [
      {
        id: "m1",
        senderId: "u3",
        text: "Good morning! Quick sync needed.",
        timestamp: "9:00 AM",
        read: true,
      },
      {
        id: "m2",
        senderId: "me",
        text: "Sure, what's up?",
        timestamp: "9:05 AM",
        read: true,
      },
      {
        id: "m3",
        senderId: "u3",
        text: "We need to re-prioritize Q1 features.",
        timestamp: "9:10 AM",
        read: true,
      },
      {
        id: "m4",
        senderId: "me",
        text: "Agreed. The analytics module should come first.",
        timestamp: "10:00 AM",
        read: true,
      },
      {
        id: "m5",
        senderId: "u3",
        text: "Sprint planning at 3pm today",
        timestamp: "11:30 AM",
        read: false,
      },
    ],
  },
  {
    id: "c4",
    userId: "u4",
    lastMessage: "Deployed to staging! Check it out.",
    lastTime: "Yesterday",
    unread: 0,
    messages: [
      {
        id: "m1",
        senderId: "u4",
        text: "Working on the new auth flow.",
        timestamp: "Yesterday",
        read: true,
      },
      {
        id: "m2",
        senderId: "me",
        text: "Great! Using OAuth2?",
        timestamp: "Yesterday",
        read: true,
      },
      {
        id: "m3",
        senderId: "u4",
        text: "Yep, plus passkey support for modern browsers.",
        timestamp: "Yesterday",
        read: true,
      },
      {
        id: "m4",
        senderId: "me",
        text: "Awesome choice. Let me know when it's on staging.",
        timestamp: "Yesterday",
        read: true,
      },
      {
        id: "m5",
        senderId: "u4",
        text: "Deployed to staging! Check it out.",
        timestamp: "Yesterday",
        read: true,
      },
    ],
  },
  {
    id: "c5",
    userId: "u5",
    lastMessage: "Campaign metrics look great 📈",
    lastTime: "Mon",
    unread: 0,
    messages: [
      {
        id: "m1",
        senderId: "u5",
        text: "Hi! The Q4 campaign is live.",
        timestamp: "Mon",
        read: true,
      },
      {
        id: "m2",
        senderId: "me",
        text: "Exciting! What's the target audience?",
        timestamp: "Mon",
        read: true,
      },
      {
        id: "m3",
        senderId: "u5",
        text: "Tech-savvy millennials, primarily.",
        timestamp: "Mon",
        read: true,
      },
      {
        id: "m4",
        senderId: "me",
        text: "Sounds perfect. How are early numbers looking?",
        timestamp: "Mon",
        read: true,
      },
      {
        id: "m5",
        senderId: "u5",
        text: "Campaign metrics look great 📈",
        timestamp: "Mon",
        read: true,
      },
    ],
  },
];

export const GROUPS: Group[] = [
  {
    id: "g1",
    name: "Engineering Team",
    memberCount: 14,
    lastMessage: "Bob: PR merged to main ✅",
    lastTime: "10:20 AM",
    color: "#2F6FE3",
    initials: "ET",
  },
  {
    id: "g2",
    name: "Design & Product",
    memberCount: 8,
    lastMessage: "Alice: New mockups shared!",
    lastTime: "9:45 AM",
    color: "#9B59B6",
    initials: "DP",
  },
  {
    id: "g3",
    name: "All Hands",
    memberCount: 42,
    lastMessage: "Carol: Q1 goals updated",
    lastTime: "Yesterday",
    color: "#1ABC9C",
    initials: "AH",
  },
];
