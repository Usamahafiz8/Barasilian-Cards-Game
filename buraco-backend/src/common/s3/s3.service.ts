import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class S3Service {
  constructor(
    private config: ConfigService,
    private sysConfig: SystemConfigService,
  ) {}

  private async getClient(): Promise<{ client: S3Client; bucket: string; region: string }> {
    const [region, accessKeyId, secretAccessKey, bucket] = await Promise.all([
      this.sysConfig.get('aws_region', this.config.get<string>('aws.region') ?? 'us-east-1'),
      this.sysConfig.get('aws_access_key_id', this.config.get<string>('aws.accessKeyId') ?? ''),
      this.sysConfig.get('aws_secret_access_key', this.config.get<string>('aws.secretAccessKey') ?? ''),
      this.sysConfig.get('aws_s3_bucket', this.config.get<string>('aws.s3Bucket') ?? ''),
    ]);
    const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    return { client, bucket, region };
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const { client, bucket, region } = await this.getClient();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
