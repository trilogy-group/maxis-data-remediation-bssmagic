import React from 'react';

const ExampleTab: React.FC = () => {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Welcome to BSS Magic</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Example Content</h2>
          <p className="text-gray-600 mb-4">
            This is your example tab content. You can add your components and features here.
          </p>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-500">
              Replace this content with your application features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExampleTab;
