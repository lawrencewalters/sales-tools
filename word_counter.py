from collections import Counter
import re

def count_words_occurrences_from_file(file_path):
    with open(file_path, 'r') as file:
        # Read lines from the file
        job_titles = file.readlines()

    # Combine all job titles into a single string
    all_titles = ' '.join(job_titles)

    # Use regex to extract words (ignoring case)
    words = re.findall(r'\b\w+\b', all_titles.lower())

    # Count occurrences of each word
    word_counts = Counter(words)

    return word_counts

if __name__ == "__main__":
    file_path = "nrf-titles.txt"  # Replace with the actual path to your text file
    result = count_words_occurrences_from_file(file_path)

    print("Word Occurrences Summary:")
    # Print the most common words first
    for word, count in result.most_common():
        print(f"{word}: {count}")
