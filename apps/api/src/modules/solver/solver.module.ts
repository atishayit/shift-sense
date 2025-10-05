import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SolverService } from './solver.service';
import { SolverController } from './solver.controller';
import { PrismaModule } from '../../prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [SolverController],
  providers: [SolverService],
})
export class SolverModule {}
