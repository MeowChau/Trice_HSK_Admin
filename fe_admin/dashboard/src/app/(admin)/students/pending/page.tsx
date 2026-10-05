import type { Metadata } from 'next';
import React from 'react';
import PendingStudentList from '../../../../components/students/PendingStudentList';

export const metadata: Metadata = {
  title: 'Học viên chờ duyệt | TRICE HSK',
  description: 'Danh sách học viên chờ duyệt',
};

export default function PendingStudentsPage() {
  return (
    <div className='p-4 sm:p-6 lg:p-8'>
      <PendingStudentList />
    </div>
  );
}
