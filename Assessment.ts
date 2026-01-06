import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseClient } from '../firebase.client';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-assessment',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './assessment.html',
  styleUrls: ['./assessment.css']
})
export class AssessmentComponent implements OnInit, OnDestroy {

  files: any[] = [];
  selectedFiles: string[] = [];
  displayedColumns: string[] = ['select', 'index', 'about', 'tags', 'size', 'status', 'date', 'converted', 'action'];

  uploadingProgress?: number;
  previewUrl?: string;
  fileName?: string;
  videoDuration?: string;
  thumbnailBlob?: Blob;
  thumbnailUrl?: string;

  currentVideo: string = '';  // For preview
  isPreviewOpen: boolean = false;

  private fb = new FirebaseClient();
  private unsub: any;
  private uploadTask: any;

  ngOnInit() {
    // Subscribe to files from Firebase
    this.unsub = this.fb.subscribeFiles(items => {
      // Make sure each file has a `url` property for preview
      this.files = items.map(f => ({
        ...f,
        url: f.downloadURL // Ensure the file URL exists
      }));
    });
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
    if (this.thumbnailUrl) URL.revokeObjectURL(this.thumbnailUrl);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
  }

  // File selection
  onFileChosen(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;

    this.fileName = file.name;
    this.previewUrl = URL.createObjectURL(file);
    (this as any)._pendingFile = file;

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = this.previewUrl;
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        this.videoDuration = this.formatDuration(video.duration);
        video.currentTime = 1;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
          if (blob) {
            this.thumbnailBlob = blob;
            this.thumbnailUrl = URL.createObjectURL(blob);
          }
        }, 'image/jpeg', 0.8);
      };
    }

    event.target.value = '';
  }

  // Upload file
  async upload() {
    const file: File = (this as any)._pendingFile;
    if (!file) {
      alert('Please select a file first');
      return;
    }

    this.uploadingProgress = 0;

    try {
      // Upload using FirebaseClient
      const uploadedUrl = await this.fb.uploadFile(
        file,
        p => this.uploadingProgress = p,
        this.videoDuration,
        this.thumbnailBlob
      );

      // Add uploaded file to files array
      this.files.push({
        id: Date.now().toString(),
        name: file.name,
        url: uploadedUrl,
        duration: this.videoDuration,
        thumbnailUrl: this.thumbnailUrl,
        status: 'Visible',
        converted: true,
        uploadedDate: new Date().toLocaleDateString()
      });

      this.resetUploadUI();
      alert('✅ Video uploaded successfully');

    } catch (e: any) {
      if (e?.code !== 'storage/canceled') {
        alert('❌ Upload failed: ' + (e.message || 'Unknown error'));
      }
      this.resetUploadUI();
    }
  }

  cancelUpload() {
    if (this.uploadTask) {
      this.uploadTask.cancel();
      this.uploadTask = null;
    }
    this.resetUploadUI();
  }

  resetUploadUI() {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    if (this.thumbnailUrl) URL.revokeObjectURL(this.thumbnailUrl);

    this.previewUrl = undefined;
    this.fileName = undefined;
    this.videoDuration = undefined;
    this.thumbnailBlob = undefined;
    this.thumbnailUrl = undefined;
    this.uploadingProgress = undefined;
    (this as any)._pendingFile = null;
  }

  // Toggle visibility
  toggle(f: any) {
    this.fb.updateVisibility(f.id, f.status !== 'Visible');
  }

  // Delete file
  remove(f: any) {
    if (confirm('Delete this video?')) {
      this.fb.deleteFile(f.id);
      this.files = this.files.filter(x => x.id !== f.id);
    }
  }

  selectAll(e: any) {
    this.selectedFiles = e.checked ? this.files.map(f => f.id) : [];
  }

  selectFile(id: string, e: any) {
    if (e.checked) {
      if (!this.selectedFiles.includes(id)) this.selectedFiles.push(id);
    } else {
      this.selectedFiles = this.selectedFiles.filter(x => x !== id);
    }
  }

  deleteSelected() {
    if (!confirm(`Delete ${this.selectedFiles.length} items?`)) return;
    this.selectedFiles.forEach(id => this.fb.deleteFile(id));
    this.files = this.files.filter(f => !this.selectedFiles.includes(f.id));
    this.selectedFiles = [];
  }

  toggleAllVisibility() {
    const visible = confirm('Set selected to Visible?');
    this.selectedFiles.forEach(id => {
      const f = this.files.find(x => x.id === id);
      if (f) this.fb.updateVisibility(f.id, visible);
    });
  }

  onImageError(event: any) {
    event.target.style.display = 'none';
  }

  formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);

    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // 🔹 VIDEO PREVIEW FUNCTIONS
  previewVideo(url: string) {
    if (!url) return;
    this.currentVideo = url;
    this.isPreviewOpen = true;
  }

  closePreview() {
    this.isPreviewOpen = false;
    this.currentVideo = '';
  }
}