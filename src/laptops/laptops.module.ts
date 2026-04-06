import { Module } from '@nestjs/common';
import { LaptopsService } from './laptops.service';
import { LaptopsController } from './laptops.controller';

@Module({
    controllers: [LaptopsController],
    providers: [LaptopsService],
    exports: [LaptopsService],
})
export class LaptopsModule { }
