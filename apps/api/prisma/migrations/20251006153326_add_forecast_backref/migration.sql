-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'statsmodels',
    "horizonDays" INTEGER NOT NULL,
    "mapeAvg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastFold" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "foldIndex" INTEGER NOT NULL,
    "mape" DOUBLE PRECISION NOT NULL,
    "mae" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,

    CONSTRAINT "ForecastFold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForecastFold_runId_idx" ON "ForecastFold"("runId");

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastFold" ADD CONSTRAINT "ForecastFold_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ForecastRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
