import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;
}
