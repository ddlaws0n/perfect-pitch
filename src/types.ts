import { Context } from 'hono'

// Context type for API endpoints, including environment bindings and user info
export interface ApiContext {
  Bindings: CloudflareBindings
  Variables: {
    username: string
  }
}

export type HonoCtx = Context<ApiContext>

// List of technical skills you can assess during mock interviews.
// This application focuses on various skills within the tech industry
// that are commonly tested in real interviews.
export enum InterviewSkill {
  Python = 'Python',
  R = 'R',
  JupyterNotebooks = 'Jupyter Notebooks',
  SQL = 'SQL',
  DataAnalysis = 'Data Analysis',
  DataScience = 'Data Science',
  Communication = 'Communication',
  ProblemSolving = 'Problem Solving',
  Visualizations = 'Visualizations',
}

// Available interview types based on different engineering roles.
// This helps tailor the interview experience and questions to
// match the candidate's target position.
export enum InterviewTitle {
  JuniorDataAnalyst = 'Junior Data Analyst Interview',
  SeniorDataAnalyst = 'Senior Data Analyst Interview',
  BusinessAnalyst = 'BusinessAnalyst',
  TechnicalAccountManager = 'Technical Account Manager Interview',
  SystemArchitect = 'System Architect Interview',
}

// Tracks the current state of an interview session.
// This will help you to manage the interview flow and show appropriate UI/actions
// at each stage of the process.
export enum InterviewStatus {
  Created = 'created', // Interview is created but not started
  Pending = 'pending', // Waiting for interviewer/system
  InProgress = 'in_progress', // Active interview session
  Completed = 'completed', // Interview finished successfully
  Cancelled = 'cancelled', // Interview terminated early
}

// Defines who sent a message in the interview chat
export type MessageRole = 'user' | 'assistant' | 'system'

// Structure of individual messages exchanged during the interview
export interface Message {
  messageId: string // Unique identifier for the message
  interviewId: string // Links message to specific interview
  role: MessageRole // Who sent the message
  content: string // The actual message content
  timestamp: number // When the message was sent
}

// Main data structure that holds all information about an interview session.
// This includes metadata, messages exchanged, and the current status.
export interface InterviewData {
  interviewId: string
  title: InterviewTitle
  skills: InterviewSkill[]
  messages: Message[]
  status: InterviewStatus
  createdAt: number
  updatedAt: number
}

// Input format for creating a new interview session.
// Simplified interface that accepts basic parameters needed to start an interview.
export interface InterviewInput {
  title: string
  skills: string[]
}
