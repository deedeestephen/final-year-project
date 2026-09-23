import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { IsSafeText } from '../../common/validation/safe-text';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'patient@example.org' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: 12,
    maxLength: 128,
    description: 'At least 12 characters; a passphrase is recommended',
  })
  @IsString()
  @Length(1, 128)
  password!: string;

  @ApiProperty({ example: 'Mwamba B.' })
  @IsString()
  @Length(1, 100)
  @IsSafeText()
  displayName!: string;
}

export class LoginDto {
  @ApiProperty()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  newPassword!: string;
}

export class SessionResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: 'Bearer';
  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn!: number;
}

export class LoginUserSummary {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({
    enum: ['PATIENT', 'CLINICIAN', 'PATHOLOGIST', 'ADMIN'],
    isArray: true,
  })
  roles!: string[];
  @ApiProperty() mustChangePassword!: boolean;
}

export class LoginResponse extends SessionResponse {
  @ApiProperty({ type: LoginUserSummary }) user!: LoginUserSummary;
}

export class RegisteredUserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
}

export class MessageResponse {
  @ApiPropertyOptional() message!: string;
}
