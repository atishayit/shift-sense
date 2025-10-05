import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SolverService } from './solver.service';
import { SolverController } from './solver.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [HttpModule, CommonModule],
  controllers: [SolverController],
  providers: [SolverService],
})
export class SolverModule {}
