-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "StandupStatus" AS ENUM ('PENDING', 'GOAL_SET', 'SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_ACHIEVED');

-- CreateEnum
CREATE TYPE "BlockerCategory" AS ENUM ('TECHNICAL', 'RESOURCE', 'COMMUNICATION', 'EXTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BlockerSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BLOCKER_ALERT', 'SUBMISSION_NOTIFICATION', 'DAILY_REMINDER', 'WEEKLY_REPORT', 'APPROVAL_NOTIFICATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "department" TEXT NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalSetTime" TIMESTAMP(3),
    "todayGoal" TEXT,
    "submissionTime" TIMESTAMP(3),
    "achievementTitle" VARCHAR(100),
    "achievementDesc" TEXT,
    "goalStatus" "GoalStatus",
    "completionPercentage" INTEGER,
    "notAchievedReason" TEXT,
    "status" "StandupStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "managerFeedback" TEXT,
    "isLateSubmission" BOOLEAN NOT NULL DEFAULT false,
    "clickupTaskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiInsights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "standupId" TEXT,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BlockerCategory" NOT NULL,
    "severity" "BlockerSeverity" NOT NULL,
    "supportRequired" TEXT NOT NULL,
    "status" "BlockerStatus" NOT NULL DEFAULT 'OPEN',
    "escalatedTo" TEXT,
    "escalationNotes" TEXT,
    "escalationDeadline" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "aiAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "filesize" INTEGER NOT NULL,
    "mimetype" TEXT NOT NULL,
    "standupId" TEXT,
    "blockerId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "loginTime" TIMESTAMP(3),
    "logoutTime" TIMESTAMP(3),
    "hoursWorked" DOUBLE PRECISION,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

-- CreateIndex
CREATE INDEX "Standup_userId_date_idx" ON "Standup"("userId", "date");

-- CreateIndex
CREATE INDEX "Standup_status_idx" ON "Standup"("status");

-- CreateIndex
CREATE INDEX "Standup_date_idx" ON "Standup"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Standup_userId_date_key" ON "Standup"("userId", "date");

-- CreateIndex
CREATE INDEX "Blocker_userId_status_idx" ON "Blocker"("userId", "status");

-- CreateIndex
CREATE INDEX "Blocker_status_idx" ON "Blocker"("status");

-- CreateIndex
CREATE INDEX "Blocker_severity_idx" ON "Blocker"("severity");

-- CreateIndex
CREATE INDEX "Blocker_createdAt_idx" ON "Blocker"("createdAt");

-- CreateIndex
CREATE INDEX "File_standupId_idx" ON "File"("standupId");

-- CreateIndex
CREATE INDEX "File_blockerId_idx" ON "File"("blockerId");

-- CreateIndex
CREATE INDEX "Attendance_userId_date_idx" ON "Attendance"("userId", "date");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_date_key" ON "Attendance"("userId", "date");

-- CreateIndex
CREATE INDEX "NotificationLog_type_idx" ON "NotificationLog"("type");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Standup" ADD CONSTRAINT "Standup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_standupId_fkey" FOREIGN KEY ("standupId") REFERENCES "Standup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_standupId_fkey" FOREIGN KEY ("standupId") REFERENCES "Standup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Blocker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
