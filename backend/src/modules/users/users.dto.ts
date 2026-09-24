import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsSafeText } from '../../common/validation/safe-text';
import { ROLES, type RoleName } from '../access/permissions';

export class CreateUserDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  @IsSafeText()
  displayName!: string;

  @ApiProperty({ enum: ROLES, isArray: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(ROLES, { each: true })
  roles!: RoleName[];

  @ApiPropertyOptional({
    description: 'Required for clinicians and pathologists',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @IsSafeText()
  displayName?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @ApiPropertyOptional({
    enum: ROLES,
    isArray: true,
    description: 'Requires role:manage',
  })
  @IsOptional()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(ROLES, { each: true })
  roles?: RoleName[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Clear a sign-in lockout' })
  @IsOptional()
  @IsBoolean()
  unlock?: boolean;
}

export class ListUsersQuery {
  @ApiPropertyOptional({ description: 'Part of the email or name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: RoleName;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class UserView {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'LOCKED', 'DISABLED'] }) status!: string;
  @ApiProperty({ enum: ROLES, isArray: true }) roles!: RoleName[];
  @ApiProperty({ nullable: true, type: String }) facilityId!: string | null;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lockedUntil!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class UserPage {
  @ApiProperty({ type: [UserView] }) items!: UserView[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class TemporaryPasswordResponse {
  @ApiProperty({
    description: 'Shown once. The user must change it at first sign-in.',
  })
  temporaryPassword!: string;
}

export class CreatedUserResponse {
  @ApiProperty({ type: UserView }) user!: UserView;
  @ApiProperty({
    description: 'Shown once. The user must change it at first sign-in.',
  })
  temporaryPassword!: string;
}
