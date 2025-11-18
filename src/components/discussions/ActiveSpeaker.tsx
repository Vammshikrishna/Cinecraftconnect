import React from 'react';

interface Participant {
  id: string;
  name: string;
  audioLevel: number;
}

interface Props {
  participants: Participant[];
}

const ActiveSpeaker: React.FC<Props> = ({ participants }) => {
  const activeSpeaker = participants.reduce(
    (prev, current) => {
      return prev.audioLevel > current.audioLevel ? prev : current;
    },
    participants[0]
  );

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Active Speaker</h2>
      {activeSpeaker && (
        <div className="border-2 border-green-500 p-2 rounded">
          <p className="font-bold">{activeSpeaker.name}</p>
        </div>
      )}
    </div>
  );
};

export default ActiveSpeaker;
