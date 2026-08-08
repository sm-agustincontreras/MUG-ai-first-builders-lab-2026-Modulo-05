import { IsNotEmpty, IsString } from 'class-validator';

export class AssignResourceDto {
  @IsString()
  @IsNotEmpty()
  resourceId!: string;
}
